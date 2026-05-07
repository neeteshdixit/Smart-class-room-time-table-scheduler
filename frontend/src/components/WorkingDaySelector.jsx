import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Calendar, ChevronRight, Settings2 } from "lucide-react";

const PRESETS = [
  { id: "MON_FRI", label: "Mon - Fri", days: [1, 2, 3, 4, 5] },
  { id: "MON_SAT", label: "Mon - Sat", days: [1, 2, 3, 4, 5, 6] },
  { id: "MON_SUN", label: "Mon - Sun", days: [1, 2, 3, 4, 5, 6, 7] },
  { id: "TUE_SAT", label: "Tue - Sat", days: [2, 3, 4, 5, 6] },
];

const DAYS_OF_WEEK = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 7, label: "Sun", full: "Sunday" },
];

export function WorkingDaySelector({ value, onChange, label, hint }) {
  const [mode, setMode] = useState("preset"); // 'preset' or 'custom'
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customDays, setCustomDays] = useState([]);

  // Initialize state based on value
  useEffect(() => {
    if (!value) {
      setSelectedPreset("MON_FRI");
      setMode("preset");
      return;
    }

    const preset = PRESETS.find((p) => p.id === value);
    if (preset) {
      setSelectedPreset(value);
      setMode("preset");
    } else {
      try {
        const parsed = typeof value === "string" && value.startsWith("[") ? JSON.parse(value) : value;
        if (Array.isArray(parsed)) {
          setCustomDays(parsed);
          setMode("custom");
          setSelectedPreset(null);
        } else {
          // Fallback
          setSelectedPreset("MON_FRI");
          setMode("preset");
        }
      } catch (e) {
        setSelectedPreset("MON_FRI");
        setMode("preset");
      }
    }
  }, [value]);

  const handlePresetSelect = (presetId) => {
    setSelectedPreset(presetId);
    setMode("preset");
    onChange(presetId);
  };

  const handleCustomToggle = () => {
    if (mode === "preset") {
      const currentDays = PRESETS.find((p) => p.id === selectedPreset)?.days || [1, 2, 3, 4, 5];
      setCustomDays(currentDays);
      setMode("custom");
      // Don't call onChange yet, wait for user to pick days
    } else {
      setMode("preset");
      setSelectedPreset("MON_FRI");
      onChange("MON_FRI");
    }
  };

  const toggleDay = (dayId) => {
    const nextDays = customDays.includes(dayId)
      ? customDays.filter((id) => id !== dayId)
      : [...customDays, dayId].sort((a, b) => a - b);

    setCustomDays(nextDays);
    onChange(JSON.stringify(nextDays));
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-200">{label}</label>
          <button
            type="button"
            onClick={handleCustomToggle}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${mode === "custom" ? "text-blue-400" : "text-slate-500 hover:text-slate-300"
              }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {mode === "custom" ? "Back to presets" : "Custom selector"}
          </button>
        </div>
      )}

      <div className="relative">
        <AnimatePresence mode="wait">
          {mode === "preset" ? (
            <motion.div
              key="presets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {PRESETS.map((preset) => {
                const isActive = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`relative flex flex-col items-center justify-center rounded-2xl border p-4 transition-all duration-300 ${isActive
                        ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                  >
                    <Calendar className={`mb-2 h-5 w-5 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                    <span className={`text-xs font-bold ${isActive ? "text-white" : "text-slate-400"}`}>
                      {preset.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="active-preset-glow"
                        className="absolute inset-0 -z-10 rounded-2xl bg-blue-500/5 blur-xl"
                      />
                    )}
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="custom"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Select working days
              </p>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = customDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 ${isSelected
                          ? "border-blue-500 bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                          : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                        }`}
                      title={day.full}
                    >
                      <span className="text-xs font-bold">{day.label}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm"
                        >
                          <Check className="h-2.5 w-2.5 stroke-[4]" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 flex items-center gap-2 text-[10px] font-medium text-slate-500">
                <ChevronRight className="h-3 w-3" />
                Current selection: {customDays.map(d => DAYS_OF_WEEK.find(dw => dw.id === d).label).join(", ") || "None"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
