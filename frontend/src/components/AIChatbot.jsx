import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { aiApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function createId(prefix = "msg") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getWelcomeMessage(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") {
    return "Hello! I'm your Smart Timetable Assistant. Ask me about timetable generation, faculty setup, rooms, conflicts, reports, feedback analytics, dashboard workflows, or even just say hi and chat a bit.";
  }
  if (normalized === "faculty") {
    return "Hello! I'm your Smart Timetable Assistant. Ask me about your timetable, student timetable sharing, absences, room checks, conflict explanations, or even just say hello.";
  }
  if (normalized === "student") {
    return "Hello! I'm your Smart Timetable Assistant. Ask me about your timetable, class timings, rooms, schedule confusion, or just say hi if you want to chat.";
  }
  return "Hello! I'm your Smart Timetable Assistant. Ask me anything about timetable, faculty, classrooms, attendance, dashboard workflows, or just say hello.";
}

function getQuickActions(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") {
    return ["Generate timetable", "Explain conflicts", "Room availability", "Feedback analysis"];
  }
  if (normalized === "faculty") {
    return ["Show my timetable", "Share student timetable", "Explain conflicts", "Submit feedback"];
  }
  if (normalized === "student") {
    return ["Show my timetable", "What is my next class?", "Room availability", "Submit feedback"];
  }
  return ["Show my timetable", "Explain conflicts", "Add faculty", "Generate timetable"];
}

function getServiceBadge(status, modelName) {
  if (status === "ready") {
    return {
      tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: modelName ? `Local AI ready - ${modelName}` : "Local AI ready",
    };
  }

  if (status === "offline") {
    return {
      tone: "text-amber-300 border-amber-500/20 bg-amber-500/10",
      icon: <WifiOff className="h-3.5 w-3.5" />,
      label: "Fallback mode",
    };
  }

  return {
    tone: "text-slate-300 border-white/10 bg-white/5",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "Checking local AI",
  };
}

function TypewriterText({ text, animate }) {
  const fullText = String(text || "");
  const [visibleText, setVisibleText] = useState(animate ? "" : fullText);

  useEffect(() => {
    if (!animate) {
      setVisibleText(fullText);
      return undefined;
    }

    let index = 0;
    const step = Math.max(1, Math.ceil(fullText.length / 32));
    setVisibleText("");

    const timer = setInterval(() => {
      index += step;
      if (index >= fullText.length) {
        setVisibleText(fullText);
        clearInterval(timer);
        return;
      }
      setVisibleText(fullText.slice(0, index));
    }, 16);

    return () => clearInterval(timer);
  }, [animate, fullText]);

  return (
    <span className="whitespace-pre-wrap leading-6">
      {visibleText}
      {animate && visibleText !== fullText ? <span className="ml-0.5 inline-block animate-pulse">|</span> : null}
    </span>
  );
}

function ChatBubble({ message, animateLastAssistant }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={isUser ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={[
          "max-w-[84%] rounded-3xl px-4 py-3 text-sm shadow-lg backdrop-blur-xl",
          isUser
            ? "rounded-br-md border border-indigo-400/20 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-[0_18px_50px_rgba(56,189,248,0.18)]"
            : "rounded-bl-md border border-white/10 bg-white/8 text-slate-100 shadow-[0_18px_60px_rgba(2,6,23,0.35)]",
        ].join(" ")}
      >
        <TypewriterText text={message.content} animate={animateLastAssistant && !isUser} />

        {Array.isArray(message.suggestions) && message.suggestions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <span
                key={suggestion}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200"
              >
                {suggestion}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

const AIChatbot = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("checking");
  const [serviceModel, setServiceModel] = useState("");
  const scrollRef = useRef(null);
  const pageContext = typeof window !== "undefined" ? window.location.pathname : "";

  const quickActions = useMemo(() => getQuickActions(user?.role), [user?.role]);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: getWelcomeMessage(user?.role),
        suggestions: quickActions,
      },
    ]);
  }, [quickActions, user?.role]);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const result = await aiApi.health();
        if (cancelled) return;
        setServiceStatus(result?.available ? "ready" : "offline");
        setServiceModel(result?.configured_model || "");
      } catch (error) {
        if (cancelled) return;
        setServiceStatus("offline");
      }
    }

    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  function resetConversation() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: getWelcomeMessage(user?.role),
        suggestions: quickActions,
      },
    ]);
    setInput("");
  }

  async function handleSend(nextMessage) {
    const rawMessage = String(nextMessage ?? input).trim();
    if (!rawMessage || isLoading) return;

    const userMessage = {
      id: createId("user"),
      role: "user",
      content: rawMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await aiApi.chat({
        message: rawMessage,
        page_context: pageContext,
      });

      const assistantMessage = {
        id: createId("assistant"),
        role: "assistant",
        content: response?.reply || "I'm still thinking about that.",
        suggestions: response?.suggestions || [],
        source: response?.source || "ollama",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (response?.source === "ollama") {
        setServiceStatus("ready");
      } else if (response?.source === "error") {
        setServiceStatus("offline");
      }
      if (response?.model) {
        setServiceModel(response.model);
      }
    } catch (error) {
      const fallbackMessage = {
        id: createId("assistant"),
        role: "assistant",
        content:
          "I couldn't reach the local AI service just now. Please make sure Ollama is running, then try again.",
        suggestions: quickActions,
        source: "error",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
      setServiceStatus("offline");
    } finally {
      setIsLoading(false);
    }
  }

  const badge = getServiceBadge(serviceStatus, serviceModel);

  return (
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mb-4 flex h-[560px] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.92))] shadow-[0_24px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
          >
            <div className="relative overflow-hidden border-b border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_top_left,rgba(99,102,241,0.2),transparent_28%)]" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-200 shadow-[0_0_30px_rgba(6,182,212,0.18)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-semibold text-white">Smart Timetable Assistant</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.tone}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">English, Hindi, and Hinglish. Domain-restricted for academic workflows.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetConversation}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                    title="New chat"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                    title="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => handleSend(action)}
                      disabled={isLoading}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {action}
                    </button>
                  ))}
                </div>

                <AnimatePresence initial={false}>
                  {messages.map((message, index) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      animateLastAssistant={index === messages.length - 1 && message.role === "assistant"}
                    />
                  ))}
                </AnimatePresence>

                {isLoading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="rounded-3xl rounded-bl-md border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-200 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 items-center gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.2s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.1s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                        </div>
                        <span>Thinking with local Ollama...</span>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-end gap-2">
                <div className="group relative flex-1">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={2}
                    placeholder="Ask about timetable, rooms, faculty, conflicts, or dashboard..."
                    className="min-h-[52px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-cyan-400/0 transition group-focus-within:opacity-100" />
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 text-white shadow-[0_18px_40px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Send message"
                >
                  {isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Domain restricted to timetable workflows
                </span>
                <span>Enter to send, Shift+Enter for a new line</span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((value) => !value)}
        className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(6,182,212,0.95),rgba(99,102,241,0.95))] text-white shadow-[0_22px_60px_rgba(59,130,246,0.35)]"
        title="Open chat"
      >
        <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 blur-xl transition group-hover:opacity-100" />
        {isOpen ? <X className="relative z-10 h-5.5 w-5.5" /> : <MessageSquare className="relative z-10 h-5.5 w-5.5" />}
      </motion.button>
    </div>
  );
};

export default AIChatbot;
