"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, ShieldAlert, Wallet, SlidersHorizontal, ExternalLink, Clock, Lock, Loader2 } from "lucide-react";
import { Progress, StatusDot } from "@/components/ui/primitives";
import { formatUsdc, short, countdown, EXPLORER } from "@/lib/contracts";
import { useAgentState } from "@/lib/chain-hooks";
import { useAgentActions } from "@/lib/actions";
import type { Address } from "viem";

/**
 * Live agent card — every value here is read straight from the wallet contract.
 * The visual design is fixed; only the data source is real.
 */
export function AgentCard({
  wallet,
  isOwner,
  onActed,
}: {
  wallet: Address;
  isOwner: boolean;
  onActed: (kind: "fund" | "pause" | "drain", detail: string, hash: string, latencyMs: number, amount?: bigint) => void;
}) {
  const s = useAgentState(wallet);
  const actions = useAgentActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const expiry = s.expiry !== undefined ? countdown(s.expiry) : { label: "—", urgent: false, expired: false };
  const atLimit = s.remainingToday !== undefined && s.remainingToday === 0n && (s.dailyLimit ?? 0n) > 0n;
  const status: { label: string; dot: "ok" | "warn" | "danger" | "mute"; text: string } = expiry.expired
    ? { label: "Expired", dot: "danger", text: "text-danger" }
    : s.active === false
    ? { label: "Paused", dot: "mute", text: "text-mute" }
    : atLimit
    ? { label: "Limit Reached", dot: "warn", text: "text-warn" }
    : { label: "Active", dot: "ok", text: "text-ok" };

  async function run(kind: "fund" | "pause" | "drain", fn: () => Promise<{ hash: string; latencyMs: number }>, detail: string, amount?: bigint) {
    setErr(null);
    setBusy(kind);
    try {
      const r = await fn();
      onActed(kind, detail, r.hash, r.latencyMs, amount);
    } catch (e) {
      setErr((e as Error).message.split("\n")[0].slice(0, 80));
    } finally {
      setBusy(null);
    }
  }

  const policyForToggle = { dailyLimit: s.dailyLimit ?? 0n, maxPerTx: s.maxPerTx ?? 0n, expiry: s.expiry ?? 0n };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass glass-hover flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-arc/10 font-mono text-sm font-bold text-arc">
            {wallet.slice(2, 4).toUpperCase()}
          </div>
          <div className="leading-tight">
            <a href={`${EXPLORER}/address/${wallet}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold hover:text-arc">
              {short(wallet)} <ExternalLink size={11} className="text-faint" />
            </a>
            <p className="font-mono text-2xs text-faint">agent {s.agent ? short(s.agent) : "—"}</p>
          </div>
        </div>
        <span className={`chip border-arc/15 ${status.text}`}>
          <StatusDot tone={status.dot} />
          {status.label}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Wallet balance</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            <span className="text-faint">$</span>
            {s.balance !== undefined ? formatUsdc(s.balance) : "—"}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-1.5">
            <button
              onClick={() => run("pause", () => actions.setActive(wallet, s.active === false, policyForToggle), s.active === false ? "resumed agent" : "paused agent")}
              disabled={busy !== null || s.active === undefined}
              title={s.active === false ? "Resume agent" : "Emergency pause"}
              className="btn-glass px-2 py-2"
            >
              {busy === "pause" ? <Loader2 size={14} className="animate-spin" /> : s.active === false ? <Play size={14} className="text-ok" /> : <Pause size={14} className="text-warn" />}
            </button>
            <button
              onClick={() => run("drain", () => actions.drain(wallet, s.balance ?? 0n), "emergency drain", s.balance)}
              disabled={busy !== null || !s.balance}
              title="Emergency drain to owner"
              className="btn-danger px-2 py-2"
            >
              {busy === "drain" ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-arc/15 bg-white/[0.02] p-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <Lock size={11} className="text-arc" />
          <span className="eyebrow text-arc/80">On-chain policy guardrails</span>
        </div>

        <div className="mb-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-2xs text-mute">Daily spend</span>
            <span className="font-mono text-2xs tabular-nums">
              <span className={atLimit ? "text-warn" : "text-fg"}>${s.spentToday !== undefined ? formatUsdc(s.spentToday) : "—"}</span>
              <span className="text-faint"> / ${s.dailyLimit !== undefined ? formatUsdc(s.dailyLimit) : "—"}</span>
            </span>
          </div>
          <Progress value={Number(s.spentToday ?? 0n)} max={Number(s.dailyLimit ?? 1n)} />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <span className="chip border-arc/25 bg-arc/5 text-arc">
            <SlidersHorizontal size={11} /> Max ${s.maxPerTx !== undefined ? formatUsdc(s.maxPerTx, 0) : "—"} / tx
          </span>
          <span className={`chip border-arc/15 ${expiry.urgent ? "text-warn" : "text-mute"}`}>
            <Clock size={11} /> Hot key {expiry.label}
          </span>
        </div>

        <div>
          <p className="mb-1.5 text-2xs text-faint">Owner</p>
          <span className="chip border-arc/15 text-mute">{s.owner ? short(s.owner) : "—"}</span>
        </div>
      </div>

      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => run("fund", () => actions.fund(wallet, 1_000_000n), "funded $1.00", 1_000_000n)}
            disabled={busy !== null}
            className="btn-glass justify-center text-2xs"
          >
            {busy === "fund" ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />} Fund $1
          </button>
          <a href={`${EXPLORER}/address/${wallet}`} target="_blank" rel="noreferrer" className="btn-glass justify-center text-2xs">
            <ExternalLink size={13} /> ArcScan
          </a>
        </div>
      )}

      {err && <p className="text-2xs text-danger">{err}</p>}
    </motion.div>
  );
}
