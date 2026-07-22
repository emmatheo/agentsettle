"use client";

import { ShieldCheck, Zap, Plus, Activity, Users, Layers } from "lucide-react";
import { StatusDot } from "@/components/ui/primitives";
import { WalletButton } from "@/components/dashboard/WalletButton";

interface Stats {
  totalWallets?: bigint;
  totalAgents?: bigint;
  myAgentCount: number;
  lastLatencyMs?: number;
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "arc" | "ok" }) {
  return (
    <div className="flex items-center gap-2.5 px-4">
      <span className={accent === "ok" ? "text-ok" : accent === "arc" ? "text-arc" : "text-mute"}>{icon}</span>
      <div className="leading-tight">
        <p className="eyebrow">{label}</p>
        <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function CommandBar({ stats, onDeploy }: { stats: Stats; onDeploy: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-arc/15 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-arc/10 shadow-glow">
            <ShieldCheck size={18} className="text-arc" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-xl font-normal leading-none tracking-tight">
              Agent<span className="text-arc">Settle</span>
            </p>
            <div className="flex items-center gap-1.5">
              <StatusDot tone="ok" />
              <span className="font-mono text-2xs text-mute">Arc Testnet · Sub-second Finality Active</span>
            </div>
          </div>
        </div>

        <div className="order-3 flex w-full items-stretch divide-x divide-arc/15 overflow-x-auto lg:order-2 lg:mx-6 lg:w-auto lg:flex-1">
          <Stat icon={<Layers size={16} />} label="Total Agent Wallets" value={stats.totalWallets !== undefined ? stats.totalWallets.toString() : "—"} accent="arc" />
          <Stat icon={<Users size={16} />} label="Registered Agents" value={stats.totalAgents !== undefined ? stats.totalAgents.toString() : "—"} />
          <Stat icon={<Activity size={16} />} label="My Agents" value={String(stats.myAgentCount)} />
          <Stat icon={<Zap size={16} />} label="Last Settlement" value={stats.lastLatencyMs ? `${stats.lastLatencyMs}ms` : "—"} accent="ok" />
        </div>

        <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
          <button className="btn-arc" onClick={onDeploy}>
            <Plus size={15} />
            <span className="hidden sm:inline">Deploy New Agent Wallet</span>
            <span className="sm:hidden">Deploy</span>
          </button>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
