"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Zap, FileCheck2, ArrowRight, CircleCheck, RotateCcw, Play } from "lucide-react";
import { Tabs } from "@/components/ui/primitives";
// interactive explainer of the on-chain primitives (illustrative amounts)

export function SettlementPlayground() {
  const [tab, setTab] = useState("escrow");
  return (
    <div className="glass p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-normal leading-none">Settlement Modules</h2>
          <p className="text-2xs text-mute">Interactive explainer of the on-chain primitives — how agents settle.</p>
        </div>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "escrow", label: "Conditional Escrow", icon: <Lock size={13} /> },
            { id: "tabs", label: "Nanopayment Tabs", icon: <Zap size={13} /> },
            { id: "atomic", label: "Atomic Transfer", icon: <FileCheck2 size={13} /> },
          ]}
        />
      </div>

      <div className="min-h-[220px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "escrow" && <EscrowDemo />}
            {tab === "tabs" && <NanopaymentDemo />}
            {tab === "atomic" && <AtomicDemo />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Conditional escrow step diagram
// ---------------------------------------------------------------------------

const ESCROW_STEPS = [
  { key: "deposit", label: "Deposit locked", sub: "$100 USDC held" },
  { key: "verify", label: "Condition verified", sub: "oracle attests delivery" },
  { key: "release", label: "Instant release", sub: "funds → payee, sub-second" },
];

function EscrowDemo() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    setStep(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setStep(i);
      if (i >= ESCROW_STEPS.length) {
        clearInterval(t);
        setRunning(false);
      }
    }, 850);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {ESCROW_STEPS.map((s, i) => {
          const done = step > i;
          const activeStep = step === i + 1 || (step > i && step <= ESCROW_STEPS.length);
          return (
            <div key={s.key} className="flex flex-1 items-center gap-2">
              <div className="flex-1">
                <div
                  className={`rounded-lg border p-3 transition-colors ${
                    done ? "border-ok/40 bg-ok/5" : "border-arc/15 bg-white/[0.02]"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    {done ? (
                      <CircleCheck size={14} className="text-ok" />
                    ) : (
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-arc/25 text-[9px] text-mute">
                        {i + 1}
                      </span>
                    )}
                    <span className={`text-2xs font-medium ${done ? "text-ok" : "text-fg"}`}>{s.label}</span>
                  </div>
                  <p className="font-mono text-2xs text-faint">{s.sub}</p>
                </div>
              </div>
              {i < ESCROW_STEPS.length - 1 && (
                <ArrowRight size={14} className={step > i ? "text-ok" : "text-faint"} />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-arc/15 bg-white/[0.02] p-3">
        <p className="text-2xs text-mute">
          If the condition isn&apos;t met before the deadline, the escrow{" "}
          <span className="text-warn">auto-refunds</span> the payer — funds can never strand.
        </p>
        <button onClick={run} disabled={running} className="btn-arc shrink-0">
          <Play size={13} /> {running ? "Running…" : "Run escrow"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Nanopayment stream ticker
// ---------------------------------------------------------------------------

function NanopaymentDemo() {
  const [streaming, setStreaming] = useState(false);
  const [accrued, setAccrued] = useState(0);
  const [settled, setSettled] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!streaming) return;
    let last = performance.now();
    const rate = 0.0004 * 1000; // $/sec (0.0004 per ~ms-tick feel)
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setAccrued((a) => a + rate * dt);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [streaming]);

  function settle() {
    setSettled((s) => +(s + accrued).toFixed(4));
    setAccrued(0);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-arc/15 bg-white/[0.02] p-4">
        <p className="eyebrow">Off-chain stream</p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-arc">
          +${accrued.toFixed(4)}
        </p>
        <p className="mt-1 font-mono text-2xs text-ok">{streaming ? "+$0.0004 / sec · signed vouchers" : "idle"}</p>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
          {streaming && <div className="h-full w-1/3 rounded-full bg-arc/60 animate-sweep" />}
        </div>
      </div>

      <div className="rounded-lg border border-arc/15 bg-white/[0.02] p-4">
        <p className="eyebrow">On-chain settled</p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-ok">${settled.toFixed(4)}</p>
        <p className="mt-1 text-2xs text-mute">One transaction settles the whole tab.</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setStreaming((s) => !s)} className="btn-glass flex-1 justify-center text-2xs">
            {streaming ? "Pause stream" : "Start stream"}
          </button>
          <button onClick={settle} disabled={accrued === 0} className="btn-arc flex-1 justify-center text-2xs">
            Settle tab
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Atomic transfer + receipt
// ---------------------------------------------------------------------------

function AtomicDemo() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [receipt, setReceipt] = useState<{ id: string; latency: number } | null>(null);

  function send() {
    setState("sending");
    setReceipt(null);
    setTimeout(() => {
      setReceipt({
        id: `0x${Array.from({ length: 16 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`,
        latency: 240 + Math.floor(Math.random() * 200),
      });
      setState("done");
    }, 700);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col justify-between rounded-lg border border-arc/15 bg-white/[0.02] p-4">
        <div>
          <p className="eyebrow">Machine-to-machine transfer</p>
          <p className="mt-2 font-mono text-sm">
            Atlas <ArrowRight size={12} className="inline text-arc" /> Nova
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums">$1.50</p>
        </div>
        <button onClick={send} disabled={state === "sending"} className="btn-arc mt-3 justify-center">
          <Play size={13} /> {state === "sending" ? "Settling…" : "Send transfer"}
        </button>
      </div>

      <div className="rounded-lg border border-arc/15 bg-white/[0.02] p-4">
        <p className="eyebrow">Auto-generated receipt</p>
        <AnimatePresence mode="wait">
          {receipt ? (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 space-y-1.5 font-mono text-2xs">
              <div className="flex items-center gap-1.5 text-ok">
                <CircleCheck size={13} /> Settlement confirmed
              </div>
              <Row k="receipt_id" v={receipt.id} />
              <Row k="latency" v={`⚡ ${receipt.latency}ms`} vClass="text-ok" />
              <Row k="finality" v="deterministic · no reorg" />
              <Row k="status" v="SUCCESS" vClass="text-ok" />
            </motion.div>
          ) : (
            <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex flex-col items-center text-center">
              <RotateCcw size={18} className="text-faint" />
              <p className="mt-2 text-2xs text-mute">Trigger a transfer to generate a verifiable on-chain receipt.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ k, v, vClass }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-faint">{k}</span>
      <span className={`truncate ${vClass ?? "text-fg"}`}>{v}</span>
    </div>
  );
}
