const axios = require("axios");
const os = require("os");
const pool = require("../config/db");

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "http://127.0.0.1:11434";
  }

  const cleaned = raw.replace(/\/+$/, "");
  if (cleaned.endsWith("/api")) {
    return cleaned.slice(0, -4);
  }

  return cleaned;
}

function resolveModelName() {
  const configured = String(process.env.OLLAMA_MODEL || "").trim();
  if (configured && configured.toLowerCase() !== "auto") {
    return configured;
  }

  const totalMemoryGb = os.totalmem() / (1024 * 1024 * 1024);
  // Prefer the 1B model on lower-RAM machines for faster first-token latency.
  // Use the 3B model only when the system has enough headroom to keep it snappy.
  if (totalMemoryGb < 12) {
    return "llama3.2:1b";
  }

  return "llama3.2";
}

function stripResponseText(text) {
  return String(text || "")
    .replace(/^\s*```(?:json|text)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function safeJsonParse(value) {
  if (value && typeof value === "object") {
    return value;
  }

  let text = String(value || "").trim();
  if (!text) {
    return null;
  }

  // Remove common LLM artifacts like <think> tags if present
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  try {
    return JSON.parse(text);
  } catch (error) {
    // Try to find the first '{' and last '}' to extract the JSON object
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const extracted = text.slice(firstBrace, lastBrace + 1);
        return JSON.parse(extracted);
      } catch (innerError) {
        return null;
      }
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  const status = err?.response?.status;
  if (!status) {
    return true;
  }

  return status === 408 || status === 425 || status === 429 || status >= 500;
}

class AIService {
  constructor() {
    this.baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST);
    this.model = resolveModelName();
    this.defaultTimeoutMs = Math.max(Number.parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 0, 60000);
    this.retryCount = Number.parseInt(process.env.OLLAMA_RETRY_COUNT, 10) || 1;
    this.defaultKeepAlive = String(process.env.OLLAMA_KEEP_ALIVE || "5m").trim();
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async requestWithRetry(path, payload, { timeoutMs, retries } = {}) {
    const maxRetries = Number.isInteger(retries) ? retries : this.retryCount;
    const requestTimeoutMs = Number.isInteger(timeoutMs) ? timeoutMs : this.defaultTimeoutMs;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.client.post(path, payload, {
          timeout: requestTimeoutMs,
        });
      } catch (err) {
        lastError = err;
        if (attempt >= maxRetries || !isRetryableError(err)) {
          break;
        }
        const backoffMs = 250 * (attempt + 1);
        await sleep(backoffMs);
      }
    }

    throw lastError || new Error("Ollama request failed");
  }

  async generate({ systemPrompt = "", prompt = "", options = {} } = {}) {
    const model = String(options.model || this.model).trim();
    const payload = {
      model,
      system: String(systemPrompt || "").trim(),
      prompt: String(prompt || ""),
      stream: false,
      keep_alive: String(options.keepAlive || this.defaultKeepAlive),
      options: {
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0.2,
        top_p: Number.isFinite(options.topP) ? options.topP : 0.9,
        repeat_penalty: Number.isFinite(options.repeatPenalty) ? options.repeatPenalty : 1.1,
        num_ctx: Number.isInteger(options.numCtx) ? options.numCtx : 4096,
        num_predict: Number.isInteger(options.numPredict) ? options.numPredict : 512,
      },
    };

    if (options.format === "json") {
      payload.format = "json";
    }

    const response = await this.requestWithRetry("/api/generate", payload, {
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    });

    const text = stripResponseText(response.data?.response);
    if (!text) {
      throw new Error("Empty response from Ollama");
    }

    return {
      text,
      model: response.data?.model || model,
      raw: response.data,
      metrics: {
        total_duration: response.data?.total_duration,
        load_duration: response.data?.load_duration,
        prompt_eval_count: response.data?.prompt_eval_count,
        prompt_eval_duration: response.data?.prompt_eval_duration,
        eval_count: response.data?.eval_count,
        eval_duration: response.data?.eval_duration,
      },
    };
  }

  async generateJson({ systemPrompt = "", prompt = "", options = {} } = {}) {
    const result = await this.generate({
      systemPrompt,
      prompt: `${String(prompt || "").trim()}\n\nReturn only valid JSON.`,
      options: {
        ...options,
        format: "json",
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0,
      },
    });

    const parsed = safeJsonParse(result.text);
    if (!parsed) {
      throw new Error("Unable to parse JSON response from Ollama");
    }

    return {
      data: parsed,
      text: result.text,
      model: result.model,
      raw: result.raw,
      metrics: result.metrics,
    };
  }

  async healthCheck() {
    try {
      const [versionResult, modelsResult] = await Promise.allSettled([
        this.client.get("/api/version", { timeout: 5000 }),
        this.client.get("/api/tags", { timeout: 5000 }),
      ]);

      const versionAvailable = versionResult.status === "fulfilled";
      const modelsAvailable = modelsResult.status === "fulfilled";
      const version = versionAvailable ? versionResult.value.data?.version || "" : "";
      const models = modelsAvailable ? modelsResult.value.data?.models || [] : [];
      const installedModelNames = Array.isArray(models)
        ? models.map((item) => String(item?.name || item?.model || "").trim()).filter(Boolean)
        : [];

      return {
        available: versionAvailable || modelsAvailable,
        base_url: this.baseUrl,
        configured_model: this.model,
        version,
        models: installedModelNames,
        error: versionAvailable || modelsAvailable ? "" : "Ollama is not reachable",
      };
    } catch (error) {
      return {
        available: false,
        base_url: this.baseUrl,
        configured_model: this.model,
        error: error?.message || "Ollama is not reachable",
      };
    }
  }

  async answerQuestion(userId, question, options = {}) {
    const systemPrompt =
      options.systemPrompt ||
      "You are a helpful assistant for a smart classroom timetable platform. " +
      "Answer clearly, stay on topic, and use only the supplied context when present.";

    const prompt = options.prompt || String(question || "");
    const result = await this.generate({
      systemPrompt,
      prompt,
      options,
    });

    return result.text;
  }

  async extractLeaveIntent(text) {
    const result = await this.generateJson({
      systemPrompt:
        "Extract leave-request details from the user text. " +
        'Return JSON with keys: startDate, endDate, reason, urgency, isLeaveRequest, and confidence. ' +
        'Use ISO date format (YYYY-MM-DD) when dates are present. Set isLeaveRequest to false if the text is not a leave request.',
      prompt: `Current date: ${new Date().toISOString().slice(0, 10)}\nUser text: ${String(text || "")}`,
      options: {
        temperature: 0,
        numPredict: 220,
      },
    });

    return result.data;
  }

  calculateTimetableScore(entries) {
    let score = 100;
    const workload = {};

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const facultyId = Number(entry?.faculty_id);
      if (Number.isInteger(facultyId) && facultyId > 0) {
        workload[facultyId] = (workload[facultyId] || 0) + 1;
      }
    });

    const overloadCount = Object.values(workload).filter((count) => count > 6).length;
    score = Math.max(0, score - overloadCount * 5);
    return score;
  }

  async getUniversityContext() {
    const result = await pool.query(`
      SELECT te.*, f.full_name AS faculty_name, s.subject_name, ts.start_time, ts.day_of_week
      FROM timetable_entries te
      JOIN faculty f ON te.faculty_id = f.id
      JOIN subjects s ON te.subject_id = s.id
      JOIN time_slots ts ON te.timeslot_id = ts.id
      LIMIT 50
    `);

    return result.rows;
  }
}

module.exports = new AIService();
