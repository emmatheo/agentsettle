"use client";

import { useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { encodeFunctionData, parseEventLogs, type Address, type Hex } from "viem";
import {
  CONTRACTS,
  factoryAbi,
  agentWalletAbi,
  erc20Abi,
  USDC_ADDRESS,
} from "@/lib/contracts";
import type { FeedRow } from "@/lib/chain-hooks";

export interface ActionResult {
  hash: Hex;
  latencyMs: number;
  wallet?: Address;
}

/**
 * Real, signed write actions. Each measures wall-clock latency from send to
 * confirmed receipt — that number is genuine (not simulated) and is what the
 * "Arc Speedometer" badge shows for dashboard-initiated transactions.
 */
export function useAgentActions() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const send = useCallback(
    async (to: Address, data: Hex, value: bigint = 0n): Promise<{ hash: Hex; latencyMs: number }> => {
      if (!walletClient || !publicClient) throw new Error("Connect your wallet first.");
      const started = Date.now();
      const hash = await walletClient.sendTransaction({ to, data, value });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 150 });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
      return { hash, latencyMs: Date.now() - started };
    },
    [walletClient, publicClient]
  );

  /** Deploy a real policy-scoped agent wallet via the factory. */
  const deployAgent = useCallback(
    async (params: {
      agent: Address;
      dailyLimit: bigint;
      maxPerTx: bigint;
      expiry: bigint;
      targets?: Address[];
    }): Promise<ActionResult> => {
      if (!walletClient || !publicClient) throw new Error("Connect your wallet first.");
      const targets = params.targets ?? [CONTRACTS.settlement];
      const data = encodeFunctionData({
        abi: factoryAbi,
        functionName: "deployAgentWallet",
        args: [
          params.agent,
          { dailyLimit: params.dailyLimit, maxPerTx: params.maxPerTx, expiry: params.expiry, active: true },
          targets,
        ],
      });
      const started = Date.now();
      const hash = await walletClient.sendTransaction({ to: CONTRACTS.factory, data });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 150 });
      if (receipt.status !== "success") throw new Error("Deployment reverted.");
      const [ev] = parseEventLogs({ abi: factoryAbi, eventName: "AgentWalletDeployed", logs: receipt.logs });
      const wallet = ev ? (ev.args as { wallet: Address }).wallet : undefined;
      return { hash, latencyMs: Date.now() - started, wallet };
    },
    [walletClient, publicClient]
  );

  /** Fund an agent wallet with USDC from the connected owner. */
  const fund = useCallback(
    async (wallet: Address, amount: bigint): Promise<ActionResult> => {
      const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [wallet, amount] });
      const r = await send(USDC_ADDRESS, data);
      return r;
    },
    [send]
  );

  /** Emergency pause / resume: owner flips the policy `active` flag. */
  const setActive = useCallback(
    async (
      wallet: Address,
      active: boolean,
      policy: { dailyLimit: bigint; maxPerTx: bigint; expiry: bigint }
    ): Promise<ActionResult> => {
      const data = encodeFunctionData({
        abi: agentWalletAbi,
        functionName: "setPolicy",
        args: [{ dailyLimit: policy.dailyLimit, maxPerTx: policy.maxPerTx, expiry: policy.expiry, active }],
      });
      return send(wallet, data);
    },
    [send]
  );

  /** Emergency drain: sweep the wallet's USDC back to the owner. */
  const drain = useCallback(
    async (wallet: Address, amount: bigint): Promise<ActionResult> => {
      if (!address) throw new Error("Connect your wallet first.");
      const data = encodeFunctionData({ abi: agentWalletAbi, functionName: "ownerWithdraw", args: [address, amount] });
      return send(wallet, data);
    },
    [send, address]
  );

  return { deployAgent, fund, setActive, drain, ready: !!walletClient };
}

/** Build a FeedRow from a measured action result. */
export function actionRow(kind: FeedRow["kind"], detail: string, res: ActionResult, amount?: bigint): FeedRow {
  return {
    key: res.hash,
    kind,
    detail,
    amount,
    txHash: res.hash,
    blockNumber: 0n,
    latencyMs: res.latencyMs,
  };
}
