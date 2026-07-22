"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import type { Address, Hex } from "viem";
import { CONTRACTS, factoryAbi, registryAbi, agentWalletAbi, walletEvents, short } from "@/lib/contracts";

/**
 * Live protocol counters, read straight from the deployed contracts. These are
 * real single-call reads and refresh on an interval.
 */
export function useProtocolStats() {
  const { data: totalWallets } = useReadContract({
    address: CONTRACTS.factory,
    abi: factoryAbi,
    functionName: "totalWallets",
    query: { refetchInterval: 8000 },
  });
  const { data: totalAgents } = useReadContract({
    address: CONTRACTS.registry,
    abi: registryAbi,
    functionName: "totalAgents",
    query: { refetchInterval: 8000 },
  });
  return {
    totalWallets: (totalWallets as bigint | undefined) ?? undefined,
    totalAgents: (totalAgents as bigint | undefined) ?? undefined,
  };
}

/** The connected owner's deployed agent-wallet addresses. */
export function useMyWallets() {
  const { address } = useAccount();
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACTS.factory,
    abi: factoryAbi,
    functionName: "walletsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6000 },
  });
  return {
    wallets: (data as readonly Address[] | undefined) ?? [],
    isLoading,
    refetch,
  };
}

export interface LiveAgentState {
  address: Address;
  owner?: Address;
  agent?: Address;
  balance?: bigint;
  dailyLimit?: bigint;
  maxPerTx?: bigint;
  expiry?: bigint;
  active?: boolean;
  spentToday?: bigint;
  remainingToday?: bigint;
}

/**
 * Full live state for a single agent wallet. Each field is an independent real
 * read; the component stays functional even if one read is momentarily pending.
 */
export function useAgentState(wallet: Address): LiveAgentState {
  const common = { address: wallet, abi: agentWalletAbi, query: { refetchInterval: 5000 } } as const;
  const { data: owner } = useReadContract({ ...common, functionName: "owner" });
  const { data: agent } = useReadContract({ ...common, functionName: "agent" });
  const { data: balance } = useReadContract({ ...common, functionName: "usdcBalance" });
  const { data: policy } = useReadContract({ ...common, functionName: "policy" });
  const { data: spentToday } = useReadContract({ ...common, functionName: "spentToday" });
  const { data: remainingToday } = useReadContract({ ...common, functionName: "remainingToday" });

  const p = policy as readonly [bigint, bigint, bigint, boolean] | undefined;
  return {
    address: wallet,
    owner: owner as Address | undefined,
    agent: agent as Address | undefined,
    balance: balance as bigint | undefined,
    dailyLimit: p?.[0],
    maxPerTx: p?.[1],
    expiry: p?.[2],
    active: p?.[3],
    spentToday: spentToday as bigint | undefined,
    remainingToday: remainingToday as bigint | undefined,
  };
}

export type FeedKind =
  | "payment"
  | "execute"
  | "deposit"
  | "withdraw"
  | "policy"
  | "target"
  | "deploy"
  | "fund"
  | "pause"
  | "drain";

export interface FeedRow {
  key: string;
  kind: FeedKind;
  detail: string;
  amount?: bigint;
  txHash: Hex;
  blockNumber: bigint;
  /** Real measured latency (ms) — only present for txs this dashboard sent. */
  latencyMs?: number;
  blocked?: boolean;
}

/**
 * Real transaction feed built from on-chain events emitted by the owner's
 * wallets plus the factory. Polls getLogs over a recent block window. It also
 * accepts locally-measured rows (real txs the dashboard just sent, with real
 * send→confirm latency) prepended via `localRows`.
 */
export function useWalletFeed(wallets: readonly Address[], localRows: FeedRow[]) {
  const publicClient = usePublicClient();
  const [chainRows, setChainRows] = useState<FeedRow[]>([]);
  const walletsKey = wallets.join(",");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function poll() {
      try {
        const latest = await publicClient!.getBlockNumber();
        const from = latest > 4000n ? latest - 4000n : 0n;

        const rows: FeedRow[] = [];

        // Factory deploy events (all deployments on this protocol)
        try {
          const deployLogs = await publicClient!.getLogs({
            address: CONTRACTS.factory,
            event: factoryAbi.find((i) => i.type === "event" && i.name === "AgentWalletDeployed") as never,
            fromBlock: from,
            toBlock: latest,
          });
          for (const l of deployLogs as unknown as {
            args: Record<string, unknown>;
            transactionHash: Hex;
            logIndex: number;
            blockNumber: bigint;
          }[]) {
            rows.push({
              key: `${l.transactionHash}-${l.logIndex}`,
              kind: "deploy",
              detail: `agent wallet ${short(String(l.args.wallet))} deployed`,
              txHash: l.transactionHash,
              blockNumber: l.blockNumber,
            });
          }
        } catch {
          /* deploy logs optional */
        }

        // Per-wallet activity events
        if (wallets.length > 0) {
          const logs = await publicClient!.getLogs({
            address: wallets as Address[],
            events: walletEvents,
            fromBlock: from,
            toBlock: latest,
          });
          for (const raw of logs) {
            const l = raw as unknown as {
              eventName: string;
              args: Record<string, bigint | string | boolean | undefined>;
              transactionHash: Hex;
              logIndex: number;
              blockNumber: bigint;
            };
            const a = l.args;
            const base = { key: `${l.transactionHash}-${l.logIndex}`, txHash: l.transactionHash, blockNumber: l.blockNumber };
            switch (l.eventName) {
              case "Payment":
                rows.push({ ...base, kind: "payment", amount: a.amount as bigint, detail: `pay → ${short(String(a.to))}` });
                break;
              case "Executed":
                rows.push({ ...base, kind: "execute", amount: a.usdcSpent as bigint, detail: `call ${short(String(a.target))}` });
                break;
              case "Deposit":
                rows.push({ ...base, kind: "deposit", amount: ((a.amountNative18 as bigint) ?? 0n) / 10n ** 12n, detail: `funded from ${short(String(a.from))}` });
                break;
              case "OwnerWithdrawal":
                rows.push({ ...base, kind: "withdraw", amount: a.amount as bigint, detail: `withdraw → ${short(String(a.to))}` });
                break;
              case "PolicyUpdated":
                rows.push({ ...base, kind: "policy", detail: `policy updated · ${a.active ? "active" : "paused"}` });
                break;
              case "TargetAllowed":
                rows.push({ ...base, kind: "target", detail: `${short(String(a.target))} ${a.allowed ? "allowed" : "revoked"}` });
                break;
            }
          }
        }

        rows.sort((x, y) => (x.blockNumber < y.blockNumber ? 1 : -1));
        if (!cancelled) {
          for (const r of rows) seen.current.add(r.key);
          setChainRows(rows.slice(0, 40));
        }
      } catch {
        /* transient RPC error — keep last good rows */
      }
    }

    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, walletsKey]);

  // Local (measured) rows first, de-duped against chain rows by txHash.
  const localHashes = new Set(localRows.map((r) => r.txHash));
  const merged = [...localRows, ...chainRows.filter((r) => !localHashes.has(r.txHash))];
  return merged.slice(0, 40);
}
