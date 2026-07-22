"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

export function StatusDot({ tone }: { tone: "ok" | "warn" | "danger" | "mute" }) {
  const color =
    tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "danger" ? "bg-danger" : "bg-faint";
  return (
    <span className="relative inline-flex h-2 w-2">
      {tone === "ok" && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-ok/70 animate-pulse-ring" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progress — thin metered bar with tone by fill level
// ---------------------------------------------------------------------------

export function Progress({ value, max, tone }: { value: number; max: number; tone?: "arc" | "warn" | "danger" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const auto = pct >= 100 ? "danger" : pct >= 85 ? "warn" : "arc";
  const t = tone ?? auto;
  const fill = t === "danger" ? "bg-danger" : t === "warn" ? "bg-warn" : "bg-arc";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs — controlled, no dependency
// ---------------------------------------------------------------------------

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-arc/15 bg-white/[0.02] p-1">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              on ? "text-base" : "text-mute hover:text-fg"
            }`}
          >
            {on && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-md bg-arc"
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {t.icon}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlideOver — right-hand drawer
// ---------------------------------------------------------------------------

export function SlideOver({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-arc/15 bg-raised/95 backdrop-blur-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="flex items-center justify-between border-b border-arc/15 px-5 py-4">
              <h3 className="font-mono text-sm font-semibold tracking-wide">{title}</h3>
              <button onClick={onClose} className="rounded-md p-1 text-mute hover:bg-white/[0.04] hover:text-fg">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
