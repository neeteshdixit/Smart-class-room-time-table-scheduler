import React, { useMemo } from "react";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { createTimetableMatrix, dayLabel, formatTimetableCell, getSlotLabel } from "../lib/timetable";
import { Badge, Card } from "./ui";

const DAY_KEYS = [1, 2, 3, 4, 5, 6];

function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}

function TimetableCell({ entry, isEmpty = false }) {
  if (!entry) {
    return <div className="h-full min-h-[110px] rounded-2xl border border-dashed border-white/10 bg-white/[0.02]" />;
  }

  const payload = formatTimetableCell(entry);
  const color = payload?.color || "#60a5fa";

  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10, y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative h-full min-h-[110px] overflow-hidden rounded-2xl border p-3 shadow-lg"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}40`,
        boxShadow: `0 10px 30px -10px ${color}30`
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-2">
        <Badge className="border-0 bg-white/10" tone="neutral">
          {payload?.subjectCode || payload?.mode}
        </Badge>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {payload?.section || payload?.faculty || ""}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        <p className="font-display text-sm font-semibold text-white">{payload?.subject}</p>
        <p className="text-xs leading-5 text-slate-300">{payload?.faculty}</p>
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span>{payload?.room}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function TimetableGrid({ entries = [], timeSlots = [], title, subtitle, compact = false, className = "" }) {
  const matrix = useMemo(() => createTimetableMatrix(entries, timeSlots), [entries, timeSlots]);

  return (
    <Card className={joinClasses("overflow-hidden", className)}>
      <div className="flex flex-col gap-3 border-b border-white/8 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          {title ? <h3 className="font-display text-xl font-semibold text-white">{title}</h3> : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Badge tone="info" className="border-0">
            <Clock3 className="mr-1 h-3.5 w-3.5" />
            Weekly view
          </Badge>
          <Badge tone="neutral" className="border-0">
            <CalendarDays className="mr-1 h-3.5 w-3.5" />
            Mon-Sat
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[110px_repeat(6,minmax(160px,1fr))] border-b border-white/8 bg-white/[0.02]">
            <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Time
            </div>
            {DAY_KEYS.map((day) => (
              <div
                key={day}
                className="border-l border-white/6 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300"
              >
                {dayLabel(day)}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/5">
            {matrix.rows.length ? (
              matrix.rows.map((row) => (
                <div
                  key={row.slotNumber}
                  className={joinClasses(
                    "grid grid-cols-[110px_repeat(6,minmax(160px,1fr))] items-stretch",
                    compact ? "min-h-[86px]" : "min-h-[124px]"
                  )}
                >
                  <div className="flex flex-col justify-center border-r border-white/6 px-4 py-3 text-sm text-slate-300">
                    <p className="font-semibold text-white">Slot {row.slotNumber}</p>
                    <p className="mt-1 text-xs text-slate-400">{getSlotLabel(row)}</p>
                  </div>
                  {DAY_KEYS.map((day) => {
                    const cell = row.cells.get(day);
                    const firstEntry = cell?.entries?.[0] || null;
                    const extraCount = Math.max(0, (cell?.entries?.length || 0) - 1);

                    return (
                      <div key={`${row.slotNumber}-${day}`} className="border-l border-white/6 p-2">
                        {firstEntry ? (
                          <div className="relative flex h-full flex-col gap-2 rounded-2xl p-2">
                            <TimetableCell entry={firstEntry} />
                            {extraCount > 0 ? (
                              <p className="text-right text-[11px] text-slate-400">
                                +{extraCount} more
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[110px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-slate-500">
                            Free
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="px-4 py-14 text-center text-sm text-slate-400">
                No timetable data available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TimetableLegend({ entries = [] }) {
  const legend = useMemo(() => {
    const seen = new Map();
    entries.forEach((entry) => {
      const key = entry.subject_code || entry.subject_name;
      if (!key || seen.has(key)) return;
      seen.set(key, {
        label: entry.subject_name || entry.subject_code || "Subject",
        color: formatTimetableCell(entry)?.color || "#60a5fa",
      });
    });
    return [...seen.values()].slice(0, 10);
  }, [entries]);

  if (!legend.length) return null;

  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        Subject Legend
      </p>
      <div className="flex flex-wrap gap-2">
        {legend.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function TimetableStatStrip({ stats }) {
  if (!stats) return null;
  const items = [
    { label: "Sections", value: stats.sectionCount || 0 },
    { label: "Subjects", value: stats.subjectCount || 0 },
    { label: "Rooms", value: stats.roomCount || 0 },
    { label: "Sessions", value: stats.entryCount || 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}

