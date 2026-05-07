import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Loader2, X, Check, Clock, Sparkles } from "lucide-react";
import { masterApi } from "../lib/api";

const RECENT_KEY_PREFIX = "scts_recent_";

export function SmartSelect({
  resource,
  label,
  value,
  onChange,
  onSelectionChange,
  filter = {},
  placeholder = "Select...",
  required = false,
  displayKey,
  hint,
  error,
  disabled = false,
  accent = "var(--accent)",
  showRecent = true,
  maxRecent = 5,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  // Handle mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Recent selections logic
  const recentKey = `${RECENT_KEY_PREFIX}${resource}`;
  const [recentItems, setRecentItems] = useState(() => {
    try {
      const saved = localStorage.getItem(recentKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToRecent = (item) => {
    if (!item) return;
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => String(i.id) !== String(item.id));
      const next = [item, ...filtered].slice(0, maxRecent);
      localStorage.setItem(recentKey, JSON.stringify(next));
      return next;
    });
  };

  // Fetch data with filtering and search
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["masterData", resource, filter, search],
    queryFn: () => masterApi.list(resource, { ...filter, q: search, limit: 50 }),
    enabled: !disabled && (isOpen || !!value),
  });

  const options = data?.data || [];
  const selectedOption = options.find((opt) => String(opt.id) === String(value)) || 
                         recentItems.find((opt) => String(opt.id) === String(value));

  // Determine display key based on resource
  const actualDisplayKey = useMemo(() => {
    if (displayKey) return displayKey;
    switch (resource) {
      case 'departments': return 'department_name';
      case 'branches': return 'branch_name';
      case 'semesters': return 'semester_number';
      case 'sections': return 'section_name';
      case 'subjects': return 'subject_name';
      case 'faculty': return 'full_name';
      case 'blocks': return 'block_name';
      case 'classrooms': return 'room_number';
      case 'laboratories': return 'lab_name';
      default: return 'id';
    }
  }, [resource, displayKey]);

  const getLabel = (opt) => {
    if (!opt) return "";
    if (resource === 'semesters') return `Semester ${opt.semester_number} (${opt.academic_year})`;
    return opt[actualDisplayKey] || opt.id;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isMobile && containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  const handleSelect = (opt) => {
    onChange(opt.id);
    if (onSelectionChange) onSelectionChange(opt);
    addToRecent(opt);
    setIsOpen(false);
    setSearch("");
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange("");
    if (onSelectionChange) onSelectionChange(null);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        {/* Floating Label / Standard Label Mix */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`group relative flex w-full flex-col items-start justify-center rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-left transition-all duration-300 focus:outline-none ${
            disabled ? "cursor-not-allowed opacity-50" : "hover:border-white/20 hover:bg-slate-900/60"
          } ${isOpen ? "ring-2" : ""}`}
          style={{ "--tw-ring-color": accent }}
        >
          {label && (
            <span className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
              selectedOption || isOpen ? "mb-1 translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            } ${isOpen ? "text-white" : "text-slate-500"}`}>
              {label} {required && <span className="text-red-400">*</span>}
            </span>
          )}
          
          <div className="flex w-full items-center justify-between gap-3">
            <span className={`truncate text-sm font-medium transition-all duration-300 ${
              selectedOption ? "text-white" : "text-slate-500"
            } ${!selectedOption && !isOpen ? "translate-y-1" : ""}`}>
              {selectedOption ? getLabel(selectedOption) : (isOpen ? "Type to search..." : placeholder)}
            </span>
            
            <div className="flex items-center gap-2">
              {value && !disabled && (
                <div 
                  onClick={clearSelection}
                  className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </div>
              )}
              {isLoading && isOpen ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              )}
            </div>
          </div>
          
          {/* Progress loader for background fetching */}
          {isFetching && !isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-2xl">
              <div className="h-full bg-white/20 animate-progress-indefinite" />
            </div>
          )}
        </button>

        {/* Dropdown / Bottom Sheet */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop for mobile */}
              {isMobile && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm"
                />
              )}
              
              <motion.div
                initial={isMobile ? { y: "100%" } : { opacity: 0, y: 8, scale: 0.98 }}
                animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                exit={isMobile ? { y: "100%" } : { opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`${
                  isMobile 
                    ? "fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] rounded-t-3xl" 
                    : "absolute left-0 right-0 z-50 mt-2 max-h-96"
                } flex flex-col overflow-hidden border border-white/10 bg-slate-900 shadow-2xl backdrop-blur-2xl`}
              >
                {/* Search Header */}
                <div className="sticky top-0 z-10 border-b border-white/5 bg-slate-900/80 p-4 backdrop-blur-md">
                  {isMobile && <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/10" />}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      autoFocus
                      type="text"
                      placeholder={`Search ${label || "options"}...`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-xl border border-white/5 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/10"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  {/* Recent Selections */}
                  {showRecent && recentItems.length > 0 && !search && (
                    <div className="mb-4 space-y-2 px-2">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <Clock className="h-3 w-3" />
                        Recent
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recentItems.map((opt) => (
                          <button
                            key={`recent-${opt.id}`}
                            type="button"
                            onClick={() => handleSelect(opt)}
                            className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                          >
                            {getLabel(opt)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Options List */}
                  <div className="space-y-1">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                        <p className="text-xs font-medium text-slate-500">Fetching results...</p>
                      </div>
                    ) : options.length > 0 ? (
                      options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelect(opt)}
                          className={`group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition-all ${
                            String(opt.id) === String(value)
                              ? "bg-white/10 text-white"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex flex-1 flex-col">
                            <span className="font-medium">{getLabel(opt)}</span>
                            {resource === 'faculty' && opt.designation && (
                              <span className="text-[10px] text-slate-500">{opt.designation} · {opt.department_name}</span>
                            )}
                          </div>
                          {String(opt.id) === String(value) && (
                            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                              <Check className="h-4 w-4 shrink-0 text-white" />
                            </motion.div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                          <Search className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-white">No results found</p>
                        <p className="mt-1 text-xs text-slate-500">Try a different search term or check filters.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer / Suggestions */}
                {!search && options.length > 0 && (
                  <div className="border-t border-white/5 bg-white/[0.02] p-4 text-center">
                    <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                      <Sparkles className="h-3 w-3" />
                      Smart suggestions active
                    </p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Helper text / Errors */}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-1.5 px-1 text-xs font-medium text-red-400"
          >
            <X className="h-3 w-3" />
            {error}
          </motion.p>
        ) : hint ? (
          <p className="px-1 text-xs text-slate-500">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
