"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { Boxes, ShieldCheck, Plug } from "lucide-react";
import { CommandBar } from "@/components/dashboard/CommandBar";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { SettlementPlayground } from "@/components/dashboard/SettlementPlayground";
import { TransactionFeed } from "@/components/dashboard/TransactionFeed";
import { DeployAgentSlideOver } from "@/components/dashboard/DeployAgentSlideOver";
import { useProtocolStats, useMyWallets, useWalletFeed, type FeedRow } from "@/lib/chain-hooks";
import type { Address } from "viem";

/**
 * AgentSettle command dashboard — 100% live on-chain data.
 *
 * Every number here is read from the deployed contracts on Arc Testnet. There
 * is no simulated data. Until a wallet is connected and an agent is deployed
 * through the factory, the fleet and feed are honestly empty.
 */
export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [localRows, setLocalRows] = useState<FeedRow[]>([]);

  useEffect(() => setMounted(true), []);

  const { totalWallets, totalAgents } = useProtocolStats();
  const { wallets } = useMyWallets();
  const feed = useWalletFeed(wallets, localRows);

  const lastLatency = localRows.find((r) => r.latencyMs !== undefined)?.latencyMs;

  function pushLocalRow(kind: FeedRow["kind"], detail: string, hash: string, latencyMs: number, amount?: bigint) {
    setLocalRows((prev) =>
      [{ key: hash, kind, detail, amount, txHash: hash as `0x${string}`, blockNumber: 0n, latencyMs }, ...prev].slice(0, 10)
    );
  }

  return (
    <div className="min-h-screen">
      {!mounted ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-2.5 text-mute">
            <ShieldCheck size={18} className="animate-pulse text-arc" />
            <span className="font-mono text-sm">Connecting to Arc Testnet…</span>
          </div>
        </div>
      ) : (
        <>
          <CommandBar
            stats={{ totalWallets, totalAgents, myAgentCount: wallets.length, lastLatencyMs: lastLatency }}
            onDeploy={() => setDeployOpen(true)}
          />

          <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
            <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Boxes size={16} className="text-mute" />
                    <h2 className="text-sm font-semibold">Agent Fleet</h2>
                    <span className="chip border-slate-200 text-faint">{wallets.length}</span>
                  </div>

                  {!isConnected ? (
                    <div className="glass flex flex-col items-center gap-3 p-10 text-center">
                      <Plug size={22} className="text-faint" />
                      <p className="text-sm text-mute">Connect your wallet to see and manage your on-chain agents.</p>
                    </div>
                  ) : wallets.length === 0 ? (
                    <div className="glass flex flex-col items-center gap-3 p-10 text-center">
                      <ShieldCheck size={22} className="text-arc" />
                      <div>
                        <p className="text-sm font-medium">No agents yet</p>
                        <p className="mt-1 text-2xs text-mute">Deploy your first policy-scoped agent wallet — one real transaction, settles sub-second.</p>
                      </div>
                      <button className="btn-arc" onClick={() => setDeployOpen(true)}>
                        Deploy your first agent
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <AnimatePresence>
                        {wallets.map((w) => (
                          <AgentCard
                            key={w}
                            wallet={w as Address}
                            isOwner={!!address}
                            onActed={pushLocalRow}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </section>

                <SettlementPlayground />
              </div>

              <div className="xl:sticky xl:top-[84px] xl:h-[calc(100vh-108px)]">
                <TransactionFeed rows={feed} />
              </div>
            </div>
          </main>

          <DeployAgentSlideOver
            open={deployOpen}
            onClose={() => setDeployOpen(false)}
            onDeployed={(wallet, hash, ms) => pushLocalRow("deploy", `agent wallet ${wallet ? wallet.slice(0, 10) : ""}… deployed`, hash, ms)}
          />
        </>
      )}
    </div>
  );
}
