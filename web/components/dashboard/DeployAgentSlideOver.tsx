"use client";

import { useState } from "react";
import { ShieldCheck, Rocket, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { SlideOver } from "@/components/ui/primitives";
import { parseUsdc, formatUsdc, short, EXPLORER } from "@/lib/contracts";
import { useAgentActions } from "@/lib/actions";

/**
 * Deploys a REAL policy-scoped agent wallet through the factory. Shows the
 * measured settlement latency and links to the new wallet on ArcScan.
 */
export function DeployAgentSlideOver({
  open,
  onClose,
  onDeployed,
}: {
  open: boolean;
  onClose: () => void;
  onDeployed: (wallet: Address | undefined, hash: string, latencyMs: number) => void;
}) {
  const { address, isConnected } = useAccount();
  const actions = useAgentActions();

  const [agentKey, setAgentKey] = useState("");
  const [dailyLimit, setDailyLimit] = useState("5.00");
  const [maxPerTx, setMaxPerTx] = useState("1.00");
  const [validHours, setValidHours] = useState("168");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ wallet?: Address; hash: string; ms: number } | null>(null);

  async function deploy() {
    setErr(null);
    try {
      const agent = agentKey.trim() || address;
      if (!agent || !isAddress(agent)) throw new Error("Enter a valid agent key address (or leave blank to use your own).");
      setBusy(true);
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(validHours || "168") * 3600);
      const res = await actions.deployAgent({
        agent: agent as Address,
        dailyLimit: parseUsdc(dailyLimit),
        maxPerTx: parseUsdc(maxPerTx),
        expiry,
      });
      setDone({ wallet: res.wallet, hash: res.hash, ms: res.latencyMs });
      onDeployed(res.wallet, res.hash, res.latencyMs);
    } catch (e) {
      setErr((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setErr(null);
    onClose();
  }

  return (
    <SlideOver open={open} onClose={reset} title="Deploy new agent wallet">
      {done ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-ok/30 bg-ok/5 p-4">
            <div className="flex items-center gap-2 text-ok">
              <CheckCircle2 size={16} />
              <span className="text-sm font-semibold">Deployed & final in {done.ms}ms</span>
            </div>
            {done.wallet && <p className="mt-2 font-mono text-2xs text-mute break-all">{done.wallet}</p>}
          </div>
          {done.wallet && (
            <a href={`${EXPLORER}/address/${done.wallet}`} target="_blank" rel="noreferrer" className="btn-glass w-full justify-center">
              <ExternalLink size={14} /> View on ArcScan
            </a>
          )}
          <button className="btn-arc w-full justify-center" onClick={reset}>
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-2.5 rounded-lg border border-arc/20 bg-arc/5 p-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-arc" />
            <p className="text-2xs text-mute">
              One real transaction deploys a policy-scoped smart wallet. The agent&apos;s hot key can never spend
              beyond these on-chain limits — enforced by the contract.
            </p>
          </div>

          <Field label="Agent hot key (blank = use your address)">
            <input className="input" placeholder="0x… or leave blank" value={agentKey} onChange={(e) => setAgentKey(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily limit (USDC)">
              <input className="input" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
            </Field>
            <Field label="Max per tx (USDC)">
              <input className="input" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
            </Field>
          </div>

          <Field label="Hot key valid for (hours)">
            <input className="input" value={validHours} onChange={(e) => setValidHours(e.target.value)} />
          </Field>

          <div className="rounded-lg border border-arc/15 bg-white/[0.02] p-3.5">
            <p className="eyebrow mb-2">Policy preview</p>
            <div className="space-y-1.5 font-mono text-2xs text-mute">
              <Row k="daily allowance" v={safePreview(dailyLimit)} />
              <Row k="max per transaction" v={safePreview(maxPerTx)} />
              <Row k="key expiry" v={`${validHours}h from deploy`} />
              <Row k="default target" v="SettlementModule" />
            </div>
          </div>

          {err && <p className="text-2xs text-danger">{err}</p>}

          <button className="btn-arc w-full justify-center" onClick={deploy} disabled={!isConnected || busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            {busy ? "Deploying on Arc…" : "Deploy agent wallet"}
          </button>
          {!isConnected && <p className="text-center text-2xs text-faint">Connect your wallet first.</p>}
        </div>
      )}
    </SlideOver>
  );
}

function safePreview(v: string): string {
  try {
    return `$${formatUsdc(parseUsdc(v))}`;
  } catch {
    return "—";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-faint">{k}</span>
      <span className="text-fg">{v}</span>
    </div>
  );
}
