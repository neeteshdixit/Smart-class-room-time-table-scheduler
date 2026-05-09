import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Layers3,
  Loader2,
  MessageSquareText,
  Sparkles,
  TriangleAlert,
  Wand2,
  Eye,
  CheckCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { feedbackApi } from "../lib/api";
import { formatDateTime, formatNumber, formatPercent } from "../lib/format";
import { Badge, Button, Card, DataTable, EmptyState, Input, SectionHeader, Select, StatCard, Textarea } from "../components/ui";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const SENTIMENT_OPTIONS = [
  { value: "", label: "All sentiments" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "neutral", label: "Neutral" },
];

const URGENCY_OPTIONS = [
  { value: "", label: "All urgency" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "faculty", label: "Faculty" },
  { value: "user", label: "Student" },
  { value: "admin", label: "Admin" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "workload imbalance", label: "Workload imbalance" },
  { value: "timetable conflict", label: "Timetable conflict" },
  { value: "room issue", label: "Room issue" },
  { value: "lab issue", label: "Lab issue" },
  { value: "faculty overload", label: "Faculty overload" },
  { value: "scheduling dissatisfaction", label: "Scheduling dissatisfaction" },
  { value: "ui complaint", label: "UI complaint" },
  { value: "performance complaint", label: "Performance complaint" },
  { value: "general feedback", label: "General feedback" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "false", label: "Unread only" },
  { value: "true", label: "Read" },
];

const FEEDBACK_EXAMPLES = [
  "Physics classes bahut continuously aa rahi hain aur workload zyada lag raha hai.",
  "timetable confusing hai, gaps aur clashes dono ho rahe hain.",
  "labs properly allocate nahi ho rahi, practical sessions ka flow break ho raha hai.",
  "Faculty schedule is too packed on Mondays, stress level is high.",
  "UI thoda slow lag raha hai aur reports load hone me time le rahi hain.",
];

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toneForSentiment(sentiment) {
  const normalized = String(sentiment || "").toLowerCase();
  if (normalized === "positive") return "success";
  if (normalized === "negative") return "danger";
  return "info";
}

function toneForUrgency(urgency) {
  const normalized = String(urgency || "").toLowerCase();
  if (normalized === "high") return "danger";
  if (normalized === "medium") return "warning";
  return "success";
}

function heatmapColor(count, max) {
  if (!max) {
    return "rgba(148, 163, 184, 0.08)";
  }
  const ratio = Math.max(0, Math.min(1, Number(count || 0) / max));
  if (ratio < 0.25) return "rgba(6, 182, 212, 0.12)";
  if (ratio < 0.5) return "rgba(59, 130, 246, 0.22)";
  if (ratio < 0.75) return "rgba(245, 158, 11, 0.26)";
  return "rgba(239, 68, 68, 0.32)";
}

function buildAnalyticsParams(filters) {
  return {
    range: filters.range,
    role: filters.role || undefined,
    sentiment: filters.sentiment || undefined,
    category: filters.category || undefined,
    urgency: filters.urgency || undefined,
    q: filters.q || undefined,
  };
}

function buildIssuesParams(f) {
  const p = buildAnalyticsParams(f);
  p.page = f.page;
  p.limit = f.limit;
  if (f.is_read !== "") p.is_read = f.is_read;
  return p;
}

function BadgeStack({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} tone="neutral" className="capitalize">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function FeedbackPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin";

  const [feedbackText, setFeedbackText] = useState("");
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionError, setSubmissionError] = useState("");
  const [isSampleExpanded, setIsSampleExpanded] = useState(false);
  const [filters, setFilters] = useState({
    range: "30d",
    sentiment: "",
    category: "",
    urgency: "",
    role: "",
    q: "",
    is_read: "",
    page: 1,
    limit: 8,
  });
  const [searchDraft, setSearchDraft] = useState("");

  const submitMutation = useMutation({
    mutationFn: (payload) => feedbackApi.submit(payload),
    onSuccess: (response) => {
      setSubmissionResult(response);
      setSubmissionError("");
      setFeedbackText("");
      queryClient.invalidateQueries({ queryKey: ["feedbackAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["feedbackTrends"] });
      queryClient.invalidateQueries({ queryKey: ["feedbackIssues"] });
    },
    onError: (error) => {
      setSubmissionError(error.message || "Unable to submit feedback");
    },
  });

  const analyticsQuery = useQuery({
    queryKey: ["feedbackAnalytics", filters.range, filters.sentiment, filters.category, filters.urgency, filters.role, filters.q],
    queryFn: () => feedbackApi.analytics(buildAnalyticsParams(filters)),
    enabled: isAdmin,
  });

  const trendsQuery = useQuery({
    queryKey: ["feedbackTrends", filters.range, filters.sentiment, filters.category, filters.urgency, filters.role, filters.q],
    queryFn: () => feedbackApi.trends(buildAnalyticsParams(filters)),
    enabled: isAdmin,
  });

  const issuesQuery = useQuery({
    queryKey: ["feedbackIssues", filters.range, filters.sentiment, filters.category, filters.urgency, filters.role, filters.q, filters.is_read, filters.page, filters.limit],
    queryFn: () => feedbackApi.issues(buildIssuesParams(filters)),
    enabled: isAdmin,
  });

  const unreadCountQuery = useQuery({
    queryKey: ["feedbackUnreadCount"],
    queryFn: () => feedbackApi.unreadCount(),
    enabled: isAdmin,
    refetchInterval: 30000, // Auto refresh every 30s
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => feedbackApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbackIssues"] });
      queryClient.invalidateQueries({ queryKey: ["feedbackUnreadCount"] });
    },
  });

  const analytics = analyticsQuery.data || null;
  const trends = trendsQuery.data || null;
  const issues = issuesQuery.data?.data || [];
  const issuePagination = issuesQuery.data?.pagination || { page: 1, limit: filters.limit, total: 0 };
  const totalPages = Math.max(1, Math.ceil((issuePagination.total || 0) / (issuePagination.limit || 1)));

  const sentimentPieData = useMemo(() => {
    const sentiment = analytics?.sentiment || {};
    return [
      { name: "Positive", value: Number(sentiment.positive_pct || 0), count: Number(analytics?.totals?.positive || 0) },
      { name: "Negative", value: Number(sentiment.negative_pct || 0), count: Number(analytics?.totals?.negative || 0) },
      { name: "Neutral", value: Number(sentiment.neutral_pct || 0), count: Number(analytics?.totals?.neutral || 0) },
    ];
  }, [analytics]);

  const topIssueData = useMemo(() => {
    return (analytics?.top_issues || []).slice(0, 8).map((item) => ({
      category: titleCase(item.category),
      count: Number(item.count || 0),
      percentage: Number(item.percentage || 0),
    }));
  }, [analytics]);

  const trendData = useMemo(() => {
    return (trends?.daily || []).map((item) => ({
      date: item.date,
      label: item.label,
      total: Number(item.total || 0),
      positive: Number(item.positive || 0),
      negative: Number(item.negative || 0),
      neutral: Number(item.neutral || 0),
      high_urgency: Number(item.high_urgency || 0),
    }));
  }, [trends]);

  const heatmapMax = useMemo(
    () => Math.max(...((trends?.heatmap || []).map((item) => Number(item.total || 0))), 0),
    [trends]
  );

  const aiInsights = analytics?.ai_insights || {};
  const facultyStress = analytics?.faculty_stress || {};
  const sentimentScore = Number(analytics?.sentiment?.satisfaction_score || analytics?.timetable_satisfaction_score || 0);

  async function handleSubmit(event) {
    event.preventDefault();
    const rawText = String(feedbackText || "").trim();
    if (!rawText) {
      setSubmissionError("Please enter feedback before submitting.");
      return;
    }

    setSubmissionError("");
    submitMutation.mutate({
      feedback_text: rawText,
      page_context: window.location.pathname,
    });
  }

  function selectSample(sample) {
    setFeedbackText(sample);
    setIsSampleExpanded(true);
  }

  function applySearch() {
    setFilters((current) => ({
      ...current,
      q: searchDraft.trim(),
      page: 1,
    }));
  }

  function resetFilters() {
    setSearchDraft("");
    setFilters({
      range: "30d",
      sentiment: "",
      category: "",
      urgency: "",
      role: "",
      q: "",
      page: 1,
      limit: 8,
    });
  }

  const pageTitle = isAdmin ? "AI Feedback Analytics" : "Share Feedback";
  const pageDescription = isAdmin
    ? "Monitor student and faculty sentiment, track overload signals, and turn raw feedback into action."
    : "Tell us what feels off. The local Ollama model analyzes your feedback for timetable issues, stress, and improvement opportunities.";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Feedback Intelligence"
        title={pageTitle}
        description={pageDescription}
        actions={[
          <Badge key="status" tone="info" className="inline-flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Local Ollama AI
          </Badge>,
          isAdmin ? (
            <Button key="analytics" variant="secondary" asChild>
              <a href="#feedback-analytics" className="inline-flex items-center gap-2">
                Open analytics
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          ) : null,
        ].filter(Boolean)}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="relative overflow-hidden p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_35%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Submit feedback</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">Describe the pain point in your own words</h3>
            </div>
            <Badge tone="success">Hindi + English + Hinglish</Badge>
          </div>

          <form className="relative mt-5 space-y-4" onSubmit={handleSubmit}>
            <Textarea
              label="Feedback text"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Example: Physics classes bahut continuously aa rahi hain aur workload zyada lag raha hai."
              rows={8}
              required
            />

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-200">Quick examples</p>
                <button
                  type="button"
                  onClick={() => setIsSampleExpanded((value) => !value)}
                  className="text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
                >
                  {isSampleExpanded ? "Hide" : "Show"} examples
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isSampleExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex flex-wrap gap-2 overflow-hidden"
                  >
                    {FEEDBACK_EXAMPLES.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => selectSample(sample)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        {sample}
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {submissionError ? (
              <Card className="border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{submissionError}</Card>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Analyze and save feedback
              </Button>
              <Button variant="secondary" type="button" onClick={() => setFeedbackText("")}>
                Clear
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">What the AI checks</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">Real sentiment, emotion, and urgency analysis</h3>
            </div>
            <Badge tone="info">Ollama + Llama3/Mistral</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Sentiment
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Positive, negative, or neutral based on meaning and tone.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Brain className="h-4 w-4 text-indigo-300" />
                Emotion
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Stress, frustration, confusion, appreciation, or satisfaction.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Layers3 className="h-4 w-4 text-orange-300" />
                Category
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Workload, timetable, room, lab, faculty overload, UI, or performance issues.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Gauge className="h-4 w-4 text-emerald-300" />
                Urgency
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Low, medium, or high urgency for faster admin action.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <MessageSquareText className="h-4 w-4" />
              Multilingual support
            </div>
            <p className="mt-2 text-sm leading-6 text-cyan-50/80">
              The local model understands English, Hindi, and Hinglish naturally, so comments like
              "workload zyada hai" or "timetable confusing hai" are analyzed without keyword hacks.
            </p>
          </div>

          {submissionResult ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Feedback saved and analyzed
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Sentiment</p>
                  <Badge tone={toneForSentiment(submissionResult.analysis?.sentiment)} className="mt-2 capitalize">
                    {submissionResult.analysis?.sentiment || "neutral"}
                  </Badge>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Emotion</p>
                  <p className="mt-2 text-sm font-semibold text-white capitalize">{submissionResult.analysis?.emotion || "neutral"}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Category</p>
                  <p className="mt-2 text-sm font-semibold text-white capitalize">{titleCase(submissionResult.analysis?.category)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Urgency</p>
                  <Badge tone={toneForUrgency(submissionResult.analysis?.urgency)} className="mt-2 capitalize">
                    {submissionResult.analysis?.urgency || "medium"}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AI recommendation</p>
                <p className="mt-2 text-sm leading-6 text-slate-100">{submissionResult.analysis?.recommendation}</p>
              </div>
              {Array.isArray(submissionResult.analysis?.signals) && submissionResult.analysis.signals.length ? (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Signals</p>
                  <BadgeStack items={submissionResult.analysis.signals.map((item) => titleCase(item))} />
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </Card>
      </div>

      {isAdmin ? (
        <>
          <div id="feedback-analytics" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={MessageSquareText}
              label="Total feedback"
              value={analytics?.totals?.total ?? 0}
              tone="admin"
            />
            <StatCard
              icon={TriangleAlert}
              label="Negative sentiment"
              value={analytics?.sentiment ? formatPercent(analytics.sentiment.negative_pct || 0) : "0%"}
              tone="danger"
            />
            <StatCard
              icon={Clock3}
              label="High urgency"
              value={analytics?.totals?.high_urgency ?? 0}
              tone="warning"
            />
            <StatCard
              icon={Gauge}
              label="Timetable satisfaction"
              value={`${sentimentScore}%`}
              tone="success"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Sentiment overview</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">AI sentiment mix</h3>
                </div>
                <Badge tone={analytics?.sentiment?.negative_pct > 40 ? "danger" : "success"}>
                  {analytics?.sentiment?.negative_pct > 40 ? "Needs attention" : "Healthy"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentPieData}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={4}
                      >
                        {sentimentPieData.map((entry, index) => {
                          const colors = ["#10B981", "#EF4444", "#06B6D4"];
                          return <Cell key={entry.name} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {sentimentPieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm">
                      <span className="text-slate-200">{entry.name}</span>
                      <span className="font-semibold text-white">
                        {entry.count} {entry.value ? `(${entry.value}%)` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">AI insights</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">What the model sees</h3>
                </div>
                <Badge tone="info">
                  <Bot className="mr-1 h-3.5 w-3.5" />
                  Ollama
                </Badge>
              </div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Headline</p>
                  <p className="mt-2 text-sm leading-6 text-white">{aiInsights.headline || "AI insights will appear here once feedback is analyzed."}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Insights</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                    {(aiInsights.insights || []).length ? (
                      aiInsights.insights.map((line) => (
                        <div key={line} className="flex gap-2">
                          <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                          <span>{line}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">Collect a few responses to unlock insight bullets.</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Flame className="h-4 w-4 text-orange-300" />
                      Faculty stress
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {facultyStress.stressed_feedback_count || 0}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">Stress or overload tagged feedback items</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Brain className="h-4 w-4 text-indigo-300" />
                      Risk flags
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-white">{(aiInsights.risk_flags || []).length}</p>
                    <p className="mt-1 text-sm text-slate-400">Signals the committee should review quickly</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Recommended actions</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                    {(aiInsights.actions || []).length ? (
                      aiInsights.actions.map((line) => (
                        <div key={line} className="flex gap-2">
                          <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                          <span>{line}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">AI actions will appear after the next analytics refresh.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Weekly / monthly trends</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">Volume and urgency over time</h3>
                </div>
                <Select
                  value={filters.range}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, range: event.target.value, page: 1 }))
                  }
                  className="min-w-[160px]"
                >
                  {RANGE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="feedbackTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="feedbackNegative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 16,
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="total" stroke="#06B6D4" fill="url(#feedbackTotal)" name="Total feedback" />
                    <Area type="monotone" dataKey="negative" stroke="#EF4444" fill="url(#feedbackNegative)" name="Negative feedback" />
                    <Line type="monotone" dataKey="high_urgency" stroke="#F59E0B" strokeWidth={2} dot={false} name="High urgency" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Heatmap</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">Feedback density by weekday</h3>
                </div>
                <Badge tone="neutral">Signal intensity</Badge>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {(trends?.heatmap || []).map((item) => (
                  <div
                    key={item.day_of_week}
                    className="rounded-2xl border border-white/10 p-3 text-center"
                    style={{ backgroundColor: heatmapColor(item.total, heatmapMax) }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{item.day_label}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{item.total}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {item.negative} neg
                      {" | "}
                      {item.high_urgency} high
                    </p>
                  </div>
                ))}
                {!trends?.heatmap?.length ? (
                  <EmptyState
                    title="No heatmap data yet"
                    description="The heatmap will populate once enough feedback arrives in the selected date range."
                    className="col-span-7"
                  />
                ) : null}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Most reported problems</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">Issue distribution</h3>
                </div>
                <Badge tone="warning">{topIssueData.length} categories</Badge>
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topIssueData} layout="vertical" margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" width={140} stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 16,
                      }}
                    />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[0, 12, 12, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Faculty stress indicators</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">Who needs support first?</h3>
                </div>
                <Badge tone={facultyStress.stressed_feedback_count > 0 ? "danger" : "success"}>
                  {facultyStress.stressed_feedback_count > 0 ? "Attention" : "Calm"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Faculty feedback</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{facultyStress.faculty_feedback_count || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">High urgency</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{facultyStress.high_urgency_count || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Stress signals</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{facultyStress.stressed_feedback_count || 0}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-white">Top departments</p>
                  <div className="mt-3 space-y-2">
                    {(facultyStress.top_departments || []).length ? (
                      facultyStress.top_departments.map((item) => (
                        <div key={item.department} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm">
                          <span className="text-slate-200">{item.department}</span>
                          <span className="font-semibold text-white">{item.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No department-level stress spike detected yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">Top faculty mentions</p>
                  <div className="mt-3 space-y-2">
                    {(facultyStress.top_faculty || []).length ? (
                      facultyStress.top_faculty.map((item) => (
                        <div key={item.full_name} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm">
                          <span className="text-slate-200">{item.full_name}</span>
                          <span className="font-semibold text-white">{item.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No individual faculty cluster is loud enough yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            {isAdmin && unreadCountQuery.data?.count > 0 && (
              <div className="mb-4 flex justify-end">
                <Badge tone="danger" className="animate-pulse py-1.5 px-3">
                  <TriangleAlert className="mr-1.5 h-3.5 w-3.5" />
                  {unreadCountQuery.data.count} New Issues
                </Badge>
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Issue triage</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-white">Search and filter feedback records</h3>
              </div>
              <Badge tone="neutral">{formatNumber(issuePagination.total || 0)} records</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <Input
                placeholder="Search feedback text or recommendation"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                className="xl:col-span-2"
              />
              <Select
                value={filters.role}
                onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, page: 1 }))}
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item.value || "all-role"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.sentiment}
                onChange={(event) => setFilters((current) => ({ ...current, sentiment: event.target.value, page: 1 }))}
              >
                {SENTIMENT_OPTIONS.map((item) => (
                  <option key={item.value || "all-sentiment"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.urgency}
                onChange={(event) => setFilters((current) => ({ ...current, urgency: event.target.value, page: 1 }))}
              >
                {URGENCY_OPTIONS.map((item) => (
                  <option key={item.value || "all-urgency"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.is_read}
                onChange={(event) => setFilters((current) => ({ ...current, is_read: event.target.value, page: 1 }))}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value || "all-status"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2 xl:col-span-6">
                <Button variant="secondary" onClick={applySearch}>
                  <AlertTriangle className="h-4 w-4" />
                  Search
                </Button>
                <Button variant="ghost" onClick={resetFilters}>
                  Reset filters
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item.value || "all-category"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.range}
                onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value, page: 1 }))}
              >
                {RANGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-5">
              <DataTable
                columns={[
                  {
                    key: "status",
                    label: "",
                    render: (row) => (
                      <div className="flex items-center justify-center">
                        {!row.is_read ? (
                          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                    ),
                  },
                  { key: "created_at", label: "Time", render: (row) => formatDateTime(row.created_at) },
                  {
                    key: "user_name",
                    label: "User",
                    render: (row) => (
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{row.user_name || "System"}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{row.user_designation || row.role}</span>
                      </div>
                    ),
                  },
                  { key: "feedback_text", label: "Feedback", render: (row) => (
                    <div className="max-w-[200px] truncate text-slate-400 text-sm" title={row.feedback_text}>
                      {row.feedback_text}
                    </div>
                  )},
                  {
                    key: "sentiment",
                    label: "Sentiment",
                    render: (row) => <Badge tone={toneForSentiment(row.sentiment)} className="capitalize">{row.sentiment}</Badge>,
                  },
                  {
                    key: "urgency",
                    label: "Urgency",
                    render: (row) => <Badge tone={toneForUrgency(row.urgency)} className="capitalize">{row.urgency}</Badge>,
                  },
                  {
                    key: "ai_recommendation",
                    label: "Recommendation",
                    render: (row) => (
                      <div className="flex items-start gap-2">
                        <Bot className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                        <span className="text-sm text-slate-300 italic">{row.ai_recommendation}</span>
                      </div>
                    ),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <div className="flex items-center gap-2">
                        {!row.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => markReadMutation.mutate(row.id)}
                            disabled={markReadMutation.isPending}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
                rows={issues}
                emptyMessage={issuesQuery.isLoading ? "Loading feedback issues..." : "No feedback items match the current filters."}
              />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              <span>
                Page {issuePagination.page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={issuePagination.page <= 1 || issuesQuery.isLoading}
                  onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  disabled={issuePagination.page >= totalPages || issuesQuery.isLoading}
                  onClick={() => setFilters((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-cyan-300">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-white">What happens after submission?</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                The feedback is analyzed locally, categorized for timetable operations, and surfaced to admins as structured insights.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Timetable issues</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Conflicts, gaps, and schedule dissatisfaction are grouped for review.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Workload stress</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Overload signals help the admin rebalance faculty and labs.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">AI recommendations</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Each item gets a concise suggestion that can be actioned quickly.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
