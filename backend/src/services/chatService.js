const { parseDurationToMs } = require("../utils/authTokens");

function buildError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const LATIN_WORD_REGEX = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;
const ROMAN_HINDI_HINT_WORDS = new Set([
  "kaise",
  "kya",
  "kyu",
  "kyun",
  "nahi",
  "haan",
  "batao",
  "samjhao",
  "karna",
  "karne",
  "karo",
  "kr",
  "krna",
  "krdo",
  "krde",
  "banega",
  "banani",
  "banao",
  "mujhe",
  "mera",
  "meri",
  "mere",
  "aap",
  "hum",
  "tum",
  "chahiye",
  "thik",
  "theek",
  "abhi",
  "yaar",
  "bhai",
]);

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

  const hasHindiScript = DEVANAGARI_REGEX.test(text);
  if (hasHindiScript) return "hindi";

  const latinWords = text.toLowerCase().match(LATIN_WORD_REGEX) || [];
  if (!latinWords.length) return "english";

  const romanHindiHits = latinWords.reduce(
    (count, word) => count + (ROMAN_HINDI_HINT_WORDS.has(word) ? 1 : 0),
    0
  );

  if (romanHindiHits >= 2) return "hinglish";
  if (romanHindiHits === 1 && latinWords.length <= 4) return "hinglish";
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
  const wantsFacultyGuide = /add\s+faculty|faculty\s+add|faculty\s+kaise|faculty|फैकल्टी|अध्यापक/.test(text);
  const wantsSubjectGuide = /add\s+subject|subject\s+add|subject\s+kaise|subject|विषय/.test(text);
  const wantsGenerateGuide =
    /generate|generation|timetable\s+ban|create\s+timetable|समय[-\s]?सारणी|टाइमटेबल/.test(text);
  const wantsErrorHelp = /error|issue|problem|failed|conflict|not working|गलती|समस्या|त्रुटि/.test(text);

  if (language === "hindi") {
    if (wantsFacultyGuide) {
      return "बिलकुल, अध्यापक जोड़ने के चरण:\n1. मुख्य पटल में शैक्षणिक डेटा अनुभाग खोलें।\n2. अध्यापक सूची में नया अभिलेख जोड़ें।\n3. पहचान क्रमांक, नाम, विभाग, ईमेल और मोबाइल जैसी जानकारी भरें।\n4. सही विषय और विभाग मानचित्रण चुनें।\n5. सहेजें और सूची में प्रविष्टि की पुष्टि करें।";
    }
    if (wantsSubjectGuide) {
      return "विषय जोड़ने के चरण:\n1. शैक्षणिक डेटा में विषय अनुभाग खोलें।\n2. नया अभिलेख जोड़ने का विकल्प चुनें।\n3. विषय कोड, नाम, विभाग, सेमेस्टर और प्रकार भरें।\n4. सिद्धांत और प्रायोगिक घंटे सही दर्ज करें।\n5. सहेजें और अध्यापक मानचित्रण की जांच करें।";
    }
    if (wantsGenerateGuide) {
      return "समय-सारणी बनाने के चरण:\n1. समय-सारणी अनुभाग खोलें।\n2. सेमेस्टर और संस्करण नाम चुनें।\n3. उपयुक्त निर्माण रणनीति चुनें।\n4. समय-सारणी निर्माण शुरू करें।\n5. चेतावनी और टकराव देखकर आवश्यक सुधार करें, फिर दोबारा निर्माण करें।";
    }
    if (wantsErrorHelp) {
      return "त्रुटि ठीक करने की त्वरित प्रक्रिया:\n1. सटीक त्रुटि संदेश लिख लें।\n2. विषय, अनुभाग और अध्यापक मानचित्रण जांचें।\n3. एक ही समय पर आने वाले कक्ष, अध्यापक या अनुभाग टकराव हटाएं।\n4. समय खंड विन्यास की पुष्टि करें।\n5. फिर से समय-सारणी बनाकर परिणाम मिलाएं।";
    }
    return "मैं अध्यापक जोड़ने, विषय प्रबंधन, समय-सारणी निर्माण और त्रुटि समाधान में आपकी मदद कर सकता हूँ। कृपया अपना प्रश्न विस्तार से लिखें।";
  }

  if (language === "hinglish") {
    if (wantsFacultyGuide) {
      return "Bilkul, faculty add karne ke steps:\n1. Dashboard me Academic Data section kholo.\n2. Faculty card me Add Record pe click karo.\n3. Faculty ID, name, department, email, mobile fill karo.\n4. Subject aur department mapping sahi select karo.\n5. Save karke list me verify karo.";
    }
    if (wantsSubjectGuide) {
      return "Subject add karne ke steps:\n1. Academic Data me Subjects open karo.\n2. Add Record pe click karo.\n3. Subject code, name, department, semester aur type select karo.\n4. Theory aur Practical hours sahi set karo.\n5. Save karo aur faculty mapping check karo.";
    }
    if (wantsGenerateGuide) {
      return "Timetable generate karne ke steps:\n1. Timetable panel open karo.\n2. Semester aur version name select karo.\n3. Strategy choose karo.\n4. Generate Timetable click karo.\n5. Conflicts aur warnings dekhkar data fix karke dobara generate karo.";
    }
    if (wantsErrorHelp) {
      return "Error fix karne ka plan:\n1. Exact error text note karo.\n2. Faculty, subject aur section mappings check karo.\n3. Room, faculty aur section ke same-slot conflicts resolve karo.\n4. Time slots configuration verify karo.\n5. Timetable dobara generate karke result compare karo.";
    }
    return "Main faculty setup, subject management, timetable generation aur error fixing me aapki madad kar sakta hoon. Apna sawaal detail me bhejo.";
  }

  if (wantsFacultyGuide) {
    return "Sure. Steps to add faculty:\n1. Open Dashboard -> Academic Data.\n2. Open Faculty and click Add Record.\n3. Fill faculty ID, name, department, email, mobile, and profile details.\n4. Map departments and subjects correctly.\n5. Save and verify in the faculty list.";
  }
  if (wantsSubjectGuide) {
    return "Steps to add subjects:\n1. Go to Academic Data -> Subjects.\n2. Click Add Record.\n3. Enter subject code, subject name, semester, department, and subject type.\n4. Set theory and practical hours accurately.\n5. Save and confirm faculty mapping.";
  }
  if (wantsGenerateGuide) {
    return "Steps to generate timetable:\n1. Open Timetable panel.\n2. Select semester and enter version name.\n3. Choose a generation strategy.\n4. Click Generate Timetable.\n5. Review conflicts and warnings, fix the data, then regenerate.";
  }
  if (wantsErrorHelp) {
    return "Quick error-fix workflow:\n1. Capture the exact error message.\n2. Verify faculty-subject and section mappings.\n3. Resolve room, faculty, and section slot conflicts.\n4. Validate time slot configuration.\n5. Re-run generation and compare results.";
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
      ? "Reply only in Hindi using Devanagari script."
      : language === "hinglish"
        ? "Reply only in Hinglish written in Roman script (do not use Devanagari)."
        : "Reply only in English.";

  const systemPrompt =
    "You are an assistant for Smart Classroom Timetable Generator. " +
    "Give practical, beginner-friendly, step-by-step guidance for dashboard operations, timetable generation, and troubleshooting. " +
    "Keep answers concise, actionable, and aligned to this project context. " +
    "Language policy: strictly use the detected language only. Do not mix languages and do not default to Hinglish. " +
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
