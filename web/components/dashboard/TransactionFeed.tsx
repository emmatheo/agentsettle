"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, ArrowRight, Activity, ExternalLink, CheckCircle2, Rocket, Wallet, Pause, ShieldAlert, Cpu } from "lucide-react";
import { formatUsdc, short, EXPLORER } from "@/lib/contracts";
import type { FeedRow, FeedKind } from "@/lib/chain-hooks";

const KIND_META: Record<FeedKind, { icon: React.ReactNode; tone: string }> = {
  payment: { icon: <ArrowRight size={13} />, tone: "text-arc border-arc/25 bg-arc/5" },
  execute: { icon: <Cpu size={13} />, tone: "text-arc border-arc/25 bg-arc/5" },
  deposit: { icon: <Wallet size={13} />, tone: "text-ok border-ok/25 bg-ok/5" },
  withdraw: { icon: <ShieldAlert size={13} />, tone: "text-warn border-warn/25 bg-warn/5" },
  policy: { icon: <Pause size={13} />, tone: "text-mute border-white/10" },
  target: { icon: <CheckCircle2 size={13} />, tone: "text-mute border-white/10" },
  deploy: { icon: <Rocket size={13} />, tone: "text-ok border-ok/25 bg-ok/5" },
  fund: { icon: <Wallet size={13} />, tone: "text-ok border-ok/25 bg-ok/5" },
  pause: { icon: <Pause size={13} />, tone: "text-warn border-warn/25 bg-warn/5" },
  drain: { icon: <ShieldAlert size={13} />, tone: "text-danger border-danger/25 bg-danger/5" },
};

export function TransactionFeed({ rows }: { rows: FeedRow[] }) {
  return (
    <div className="glass flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-arc" />
          <h2 className="text-sm font-semibold">Live Settlement Feed</h2>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-2xs text-mute">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
          on-chain
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
            <Activity size={20} className="text-faint" />
            <p className="mt-3 text-2xs text-mute">
              No on-chain activity yet. Deploy an agent or fund a wallet — real transactions appear here within
              seconds, each with its measured Arc settlement time.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const meta = KIND_META[r.kind];
            return (
              <motion.a
                key={r.key}
                layout
                initial={{ opacity: 0, backgroundColor: "rgba(0,240,255,0.08)" }}
                animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                transition={{ duration: 0.6 }}
                href={r.txHash ? `${EXPLORER}/tx/${r.txHash}` : undefined}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center gap-3 border-b border-white/[0.05] px-5 py-2.5 text-left hover:bg-white/[0.02]"
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${meta.tone}`}>
                  {meta.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-2xs text-fg">{r.detail}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-2xs text-faint">
                    <span className={`chip ${meta.tone}`}>{r.kind}</span>
                    {r.txHash && (
                      <span className="flex items-center gap-0.5 hover:text-arc">
                        {short(r.txHash)} <ExternalLink size={9} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {r.amount !== undefined && r.amount > 0n && (
                    <p className="font-mono text-sm tabular-nums text-fg">${formatUsdc(r.amount)}</p>
                  )}
                  {/* Arc Speedometer — only real, measured latency (dashboard-sent txs). */}
                  {r.latencyMs !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-ok/25 bg-ok/5 px-1.5 py-0.5 font-mono text-2xs text-ok">
                      <Zap size={10} /> {r.latencyMs}ms
                    </span>
                  ) : r.blockNumber > 0n ? (
                    <span className="font-mono text-2xs text-faint">#{r.blockNumber.toString()}</span>
                  ) : null}
                </div>
              </motion.a>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
