import React from "react";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "../lib/format";

function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className = "", children, ...props }) {
  return (
    <div className={joinClasses("glass rounded-2xl", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, actions, className = "" }) {
  return (
    <div className={joinClasses("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {title}
          </h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  variant = "primary",
  accent,
  className = "",
  children,
  asChild = false,
  type = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "text-white shadow-soft hover:-translate-y-0.5",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 hover:-translate-y-0.5",
    ghost: "bg-transparent text-slate-200 hover:bg-white/5",
    danger: "bg-red-500 text-white hover:bg-red-400",
  };
  const style = variant === "primary" ? { backgroundColor: accent || "var(--accent)" } : undefined;

  if (asChild && React.isValidElement(children)) {
    const childProps = { ...props };
    delete childProps.type;
    return React.cloneElement(children, {
      className: joinClasses(base, variants[variant] || variants.primary, className, children.props.className),
      style: { ...style, ...(children.props.style || {}) },
      ...childProps,
    });
  }

  return (
    <button type={type} className={joinClasses(base, variants[variant] || variants.primary, className)} style={style} {...props}>
      {children}
    </button>
  );
}

export function Input({
  label,
  hint,
  error,
  className = "",
  accent = "var(--accent)",
  ...props
}) {
  return (
    <label className="block space-y-2">
      {label ? <span className="block text-sm font-medium text-slate-200">{label}</span> : null}
      <input
        className={joinClasses(
          "w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-transparent focus:ring-2",
          className
        )}
        style={{ "--tw-ring-color": accent }}
        {...props}
      />
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </label>
  );
}

export function Select({
  label,
  hint,
  error,
  className = "",
  accent = "var(--accent)",
  children,
  ...props
}) {
  return (
    <label className="block space-y-2">
      {label ? <span className="block text-sm font-medium text-slate-200">{label}</span> : null}
      <select
        className={joinClasses(
          "w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-transparent focus:ring-2",
          className
        )}
        style={{ "--tw-ring-color": accent }}
        {...props}
      >
        {children}
      </select>
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className = "",
  accent = "var(--accent)",
  ...props
}) {
  return (
    <label className="block space-y-2">
      {label ? <span className="block text-sm font-medium text-slate-200">{label}</span> : null}
      <textarea
        className={joinClasses(
          "min-h-[120px] w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-transparent focus:ring-2",
          className
        )}
        style={{ "--tw-ring-color": accent }}
        {...props}
      />
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </label>
  );
}

export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "bg-white/5 text-slate-200 border-white/10",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    danger: "bg-red-500/15 text-red-300 border-red-500/20",
    info: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  };

  return (
    <span className={joinClasses("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide", tones[tone] || tones.neutral, className)}>
      {children}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, delta, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "bg-white/5 text-white",
    admin: "bg-blue-500/15 text-blue-300",
    faculty: "bg-emerald-500/15 text-emerald-300",
    student: "bg-orange-500/15 text-orange-300",
    success: "bg-emerald-500/15 text-emerald-300",
    warning: "bg-amber-500/15 text-amber-300",
    danger: "bg-red-500/15 text-red-300",
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={joinClasses("glass rounded-2xl p-5", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={joinClasses("flex h-12 w-12 items-center justify-center rounded-2xl", tones[tone] || tones.neutral)}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
        {delta ? <Badge tone={delta.tone || "neutral"}>{delta.label}</Badge> : null}
      </div>
      <div className="mt-5 space-y-1">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="font-display text-3xl font-semibold tracking-tight text-white">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
      </div>
    </motion.div>
  );
}

export function EmptyState({
  icon: Icon = ChevronRight,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div className={joinClasses("glass rounded-2xl p-8 text-center", className)}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
        <Icon className="h-6 w-6 text-slate-300" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold text-white">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function DataTable({
  columns = [],
  rows = [],
  rowKey = "id",
  renderActions,
  emptyMessage = "No records found.",
  className = "",
}) {
  return (
    <Card className={joinClasses("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-slate-950/95">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={joinClasses(
                    "border-b border-white/10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400",
                    column.className
                  )}
                >
                  {column.label}
                </th>
              ))}
              {renderActions ? (
                <th className="border-b border-white/10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={row[rowKey] ?? index} className="group transition hover:bg-white/[0.03]">
                  {columns.map((column) => (
                    <td key={column.key} className="border-b border-white/5 px-4 py-4 align-top text-sm text-slate-200">
                      {column.render ? column.render(row) : row[column.key] ?? "—"}
                    </td>
                  ))}
                  {renderActions ? (
                    <td className="border-b border-white/5 px-4 py-4 align-top text-sm text-slate-200">
                      {renderActions(row)}
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-400" colSpan={columns.length + (renderActions ? 1 : 0)}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function InlineAction({ children, onClick, className = "", title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={joinClasses(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10",
        className
      )}
    >
      {children}
    </button>
  );
}
