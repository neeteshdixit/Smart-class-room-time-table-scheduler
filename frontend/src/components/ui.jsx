import React from "react";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-200">
          {label} {props.required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="relative group">
        <input
          className={joinClasses(
            "w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 shadow-inner outline-none transition-all duration-200 focus:border-transparent focus:ring-2 group-hover:border-white/20",
            error ? "border-red-500/50 ring-red-500/20" : "",
            className
          )}
          style={{ "--tw-ring-color": accent }}
          {...props}
        />
        <div 
          className="absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" 
          style={{ backgroundColor: `${accent}10`, filter: 'blur(10px)' }}
        />
      </div>
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <motion.p 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex items-center gap-1 text-xs text-red-300"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </motion.p>
      ) : null}
    </div>
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
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-200">
          {label} {props.required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="relative group">
        <select
          className={joinClasses(
            "w-full appearance-none rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:border-transparent focus:ring-2 group-hover:border-white/20",
            error ? "border-red-500/50 ring-red-500/20" : "",
            className
          )}
          style={{ "--tw-ring-color": accent }}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-transform group-focus-within:rotate-180">
          <ChevronRight className="h-4 w-4 rotate-90" />
        </div>
        <div 
          className="absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" 
          style={{ backgroundColor: `${accent}10`, filter: 'blur(10px)' }}
        />
      </div>
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <motion.p 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex items-center gap-1 text-xs text-red-300"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </motion.p>
      ) : null}
    </div>
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
            <AnimatePresence>
              {rows.length ? (
                rows.map((row, index) => (
                  <motion.tr
                    key={row[rowKey] ?? index}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                    transition={{ duration: 0.2 }}
                    className="group transition hover:bg-white/[0.03]"
                  >
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
                  </motion.tr>
                ))
              ) : (
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td className="px-4 py-10 text-center text-sm text-slate-400" colSpan={columns.length + (renderActions ? 1 : 0)}>
                    {emptyMessage}
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
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

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm, title, description, isDeleting }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={!isDeleting ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-white">{title || 'Confirm Deletion'}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {description || 'Are you sure you want to delete this record? This action cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={onConfirm} disabled={isDeleting} className="min-w-[100px]">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export function OtpInputs({ value, onChange, autoFocus = false, accent = "var(--accent)" }) {
  const inputs = React.useRef([]);

  React.useEffect(() => {
    if (autoFocus && inputs.current[0]) {
      inputs.current[0].focus();
    }
  }, [autoFocus]);

  function updateAt(index, nextValue) {
    const chars = String(value || "").padEnd(6, " ").slice(0, 6).split("");
    chars[index] = nextValue.slice(-1);
    const nextCode = chars.join("").replace(/\s/g, "");
    onChange(nextCode);
    if (nextValue && index < 5 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
    }
  }

  function handleKeyDown(event, index) {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          value={value[index] || ""}
          onChange={(event) => updateAt(index, event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => handleKeyDown(event, index)}
          inputMode="numeric"
          maxLength={1}
          className="h-14 w-12 rounded-2xl border border-white/10 bg-slate-950/80 text-center font-mono text-xl font-semibold text-white outline-none transition focus:border-transparent focus:ring-2"
          style={{ "--tw-ring-color": accent }}
        />
      ))}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, description, children, footer, className = "" }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={joinClasses(
              "relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl",
              className
            )}
          >
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
                {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
              </div>
              <div className="py-2">{children}</div>
              {footer ? <div className="flex justify-end gap-3 pt-4">{footer}</div> : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
