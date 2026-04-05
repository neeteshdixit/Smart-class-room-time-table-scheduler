const { parseDurationToMs } = require("../utils/authTokens");

function buildError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const HINGLISH_HINT_WORDS = [
  "kaise",
  "kya",
  "kyu",
  "kyun",
  "nahi",
  "hai",
  "haan",
  "batao",
  "samjhao",
  "karna",
  "banega",
  "banani",
  "issue",
  "problem",
  "timetable",
  "faculty",
  "subject",
  "section",
  "dashboard",
];

const RATE_LIMIT_WINDOW_MS = parseDurationToMs(process.env.CHAT_RATE_LIMIT_WINDOW || "1m", 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.CHAT_RATE_LIMIT_MAX_REQUESTS, 10) || 20;

const chatRateStore = new Map();

function cleanupRateStore() {
  const now = Date.now();
  for (const [userId, item] of chatRateStore.entries()) {
    if (!item || item.windowEnd <= now) {
      chatRateStore.delete(userId);
    }
  }
}

const rateCleanupTimer = setInterval(cleanupRateStore, 30 * 1000);
if (typeof rateCleanupTimer.unref === "function") {
  rateCleanupTimer.unref();
}

function detectLanguage(message) {
  const text = String(message || "").trim();
  if (!text) return "english";
  if (DEVANAGARI_REGEX.test(text)) return "hindi";

  const lower = text.toLowerCase();
  const hintHits = HINGLISH_HINT_WORDS.reduce((count, word) => (lower.includes(word) ? count + 1 : count), 0);
  if (hintHits >= 2) return "hinglish";

  const hasEnglishWords = /[a-z]{3,}/i.test(text);
  if (hintHits >= 1 && hasEnglishWords) return "hinglish";
  return "english";
}

function assertWithinRateLimit(userId) {
  const safeUserId = Number(userId);
  if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
    throw buildError(401, "Unauthorized chat request");
  }

  const now = Date.now();
  const current = chatRateStore.get(safeUserId);
  if (!current || current.windowEnd <= now) {
    chatRateStore.set(safeUserId, { count: 1, windowEnd: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw buildError(429, "Too many chatbot requests. Please wait a minute and try again.");
  }

  current.count += 1;
  chatRateStore.set(safeUserId, current);
}

function normalizeMessage(message) {
  const text = String(message || "").trim();
  if (!text) {
    throw buildError(400, "Message is required");
  }
  if (text.length > 2000) {
    throw buildError(400, "Message is too long. Keep it under 2000 characters.");
  }
  return text;
}

function buildFallbackGuide(message, language) {
  const text = String(message || "").toLowerCase();
  const wantsFacultyGuide = /add\s+faculty|faculty\s+add|faculty\s+kaise|faculty/.test(text);
  const wantsSubjectGuide = /add\s+subject|subject\s+add|subject\s+kaise|subject/.test(text);
  const wantsGenerateGuide = /generate|generation|timetable\s+ban|create\s+timetable/.test(text);
  const wantsErrorHelp = /error|issue|problem|failed|conflict|not working/.test(text);

  if (language === "hindi") {
    if (wantsFacultyGuide) {
      return "बिल्कुल, Faculty जोड़ने के स्टेप्स:\n1. Dashboard खोलें और Academic Data सेक्शन पर जाएं।\n2. Faculty कार्ड चुनें और Add Record पर क्लिक करें।\n3. Faculty ID, नाम, विभाग, ईमेल, मोबाइल और बाकी जानकारी भरें।\n4. सही subjects और departments मैप करें।\n5. Save करें और सूची में एंट्री verify करें।";
    }
    if (wantsSubjectGuide) {
      return "Subject जोड़ने के स्टेप्स:\n1. Academic Data में Subjects खोलें।\n2. Add Record पर क्लिक करें।\n3. Subject code, नाम, विभाग, semester और type (Theory/Practical) भरें।\n4. घंटे सही डालें (theory/practical)।\n5. Save करें और faculty mapping चेक करें।";
    }
    if (wantsGenerateGuide) {
      return "Timetable generate करने के स्टेप्स:\n1. Timetable पैनल में जाएं।\n2. सही semester और version name चुनें।\n3. Generation strategy चुनें (Balanced/Compact/Faculty Friendly)।\n4. Generate Timetable पर क्लिक करें।\n5. Result में conflicts और warnings देखें, फिर ज़रूरत हो तो data सुधारकर दुबारा generate करें।";
    }
    if (wantsErrorHelp) {
      return "Error fix करने का quick तरीका:\n1. Error message का exact text नोट करें।\n2. Sections, Subjects, Faculty mappings और Time slots verify करें।\n3. Duplicate conflicts (faculty/room/section same slot) हटाएं।\n4. Timetable फिर से generate करें।\n5. अगर चाहें तो error text भेजें, मैं step-by-step debug कराऊँगा।";
    }
    return "मैं आपकी मदद कर सकता हूँ: faculty add करना, subjects set करना, timetable generate करना, और errors fix करना। अपना सवाल थोड़ा detail में भेजें।";
  }

  if (language === "hinglish") {
    if (wantsFacultyGuide) {
      return "Bilkul, faculty add karne ke steps:\n1. Dashboard me Academic Data section kholo.\n2. Faculty card me Add Record pe click karo.\n3. Faculty ID, name, department, email, mobile fill karo.\n4. Subject/department mapping sahi select karo.\n5. Save karke list me verify karo.";
    }
    if (wantsSubjectGuide) {
      return "Subject add karne ke steps:\n1. Academic Data me Subjects open karo.\n2. Add Record pe click karo.\n3. Subject code, name, department, semester aur type select karo.\n4. Theory/Practical hours sahi set karo.\n5. Save karo aur faculty mapping check karo.";
    }
    if (wantsGenerateGuide) {
      return "Timetable generate flow:\n1. Timetable panel open karo.\n2. Semester aur version name select karo.\n3. Strategy choose karo (Balanced/Compact/Faculty Friendly).\n4. Generate Timetable click karo.\n5. Result me conflicts/warnings dekh ke data fix karke re-run karo.";
    }
    if (wantsErrorHelp) {
      return "Error fix karne ka fast plan:\n1. Exact error text copy karo.\n2. Faculty-subject mapping aur section setup check karo.\n3. Room/faculty/section same-slot conflicts resolve karo.\n4. Time slots configuration verify karo.\n5. Fir timetable generate karke output compare karo.";
    }
    return "Main aapko step-by-step guide kar sakta hoon: faculty add, subjects setup, timetable generate, aur error fixing. Aap apna question bhejo.";
  }

  if (wantsFacultyGuide) {
    return "Sure. Steps to add faculty:\n1. Open Dashboard -> Academic Data.\n2. Open Faculty and click Add Record.\n3. Fill faculty ID, name, department, email, mobile, and profile details.\n4. Map departments and subjects correctly.\n5. Save and verify in the faculty list.";
  }
  if (wantsSubjectGuide) {
    return "Steps to add subjects:\n1. Go to Academic Data -> Subjects.\n2. Click Add Record.\n3. Enter subject code, subject name, semester, department, and subject type.\n4. Set theory/practical hours accurately.\n5. Save and confirm faculty mapping.";
  }
  if (wantsGenerateGuide) {
    return "Steps to generate timetable:\n1. Open Timetable panel.\n2. Select semester and enter version name.\n3. Choose strategy (Balanced/Compact/Faculty Friendly).\n4. Click Generate Timetable.\n5. Review conflicts/warnings and correct data if needed, then regenerate.";
  }
  if (wantsErrorHelp) {
    return "Quick error-fix workflow:\n1. Capture the exact error message.\n2. Verify faculty-subject and section mappings.\n3. Resolve room/faculty/section slot conflicts.\n4. Validate time slot configuration.\n5. Re-run generation and compare results.";
  }

  return "I can help with adding faculty, managing subjects, generating timetables, and fixing timetable errors. Ask your question and I will guide you step by step.";
}

function extractOpenAiText(data) {
  if (!data || typeof data !== "object") return "";

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = Array.isArray(data.output) ? data.output : [];
  const texts = [];

  chunks.forEach((chunk) => {
    const content = Array.isArray(chunk?.content) ? chunk.content : [];
    content.forEach((item) => {
      const text = String(item?.text || "").trim();
      if (text) texts.push(text);
    });
  });

  return texts.join("\n").trim();
}

async function requestOpenAiReply({ message, language, role }) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return "";

  const model = String(process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini").trim();
  const timeoutMs = Number.parseInt(process.env.OPENAI_CHAT_TIMEOUT_MS, 10) || 18000;
  const languageDirective =
    language === "hindi"
      ? "Reply only in Hindi."
      : language === "hinglish"
        ? "Reply in natural Hinglish (Roman Hindi mixed with simple English)."
        : "Reply in clear English.";

  const systemPrompt =
    "You are an assistant for Smart Classroom Timetable Generator. " +
    "Give practical, beginner-friendly, step-by-step guidance for dashboard operations, timetable generation, and troubleshooting. " +
    "Keep answers concise, actionable, and aligned to this project context. " +
    languageDirective +
    ` User role: ${String(role || "faculty")}.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: message }],
          },
        ],
        temperature: 0.2,
        max_output_tokens: 450,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    return extractOpenAiText(data);
  } catch (err) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function generateChatReply({ message, user }) {
  const normalizedMessage = normalizeMessage(message);
  assertWithinRateLimit(user?.userId);

  const language = detectLanguage(normalizedMessage);
  const role = String(user?.role || "").trim().toLowerCase();

  const aiReply = await requestOpenAiReply({
    message: normalizedMessage,
    language,
    role,
  });

  const reply = aiReply || buildFallbackGuide(normalizedMessage, language);

  return {
    reply,
    language,
  };
}

module.exports = {
  detectLanguage,
  generateChatReply,
};
