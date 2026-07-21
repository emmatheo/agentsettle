/**
 * AgentSettle demo agent — an autonomous TREASURY REBALANCER.
 *
 * What it does, forever, with real on-chain transactions on Arc Testnet:
 *
 *   every LOOP_MS:
 *     1. read worker wallet's USDC balance
 *     2. if balance < LOW_WATER  → top up to TARGET from the treasury wallet
 *        via SettlementModule.transferWithReceipt (on-chain receipt both
 *        agents can verify)
 *     3. every HEARTBEAT_EVERY loops → ping AgentRegistry.heartbeat so the
 *        dashboard shows the agent as live
 *     4. log Arc's confirmation latency + the exact USDC fee for every tx
 *
 * Crucially, the agent key CANNOT exceed its policy: if it tries to move more
 * than maxPerTx or blow the daily limit, the wallet contract reverts and the
 * agent backs off — safety is enforced by the chain, not by this script.
 *
 * Run: npm run start   (after npm run setup)
 */
import "dotenv/config";
import type { Address } from "viem";
import { AgentSettleSDK, usd, formatUsd } from "@agentsettle/sdk";

const LOOP_MS = 15_000;
const HEARTBEAT_EVERY = 4; // loops
const LOW_WATER = usd(0.5);  // top up when worker drops below $0.50
const TARGET = usd(1.5);     // …back up to $1.50

function env(name: string): Address {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} in agent/.env (run \`npm run setup\` first)`);
  return v as Address;
}

const treasury = env("TREASURY_WALLET");
const worker = env("WORKER_WALLET");

const sdk = new AgentSettleSDK();

let loop = 0;
let consecutiveFailures = 0;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function tick(): Promise<void> {
  loop++;

  const [workerState, treasuryState] = await Promise.all([
    sdk.getAgentState(worker),
    sdk.getAgentState(treasury),
  ]);

  log(
    `worker=$${formatUsd(workerState.balance)} treasury=$${formatUsd(treasuryState.balance)} ` +
      `treasury-remaining-today=$${formatUsd(treasuryState.remainingToday)}`
  );

  if (workerState.balance < LOW_WATER) {
    const needed = TARGET - workerState.balance;
    // Respect our own policy proactively: never attempt more than maxPerTx or
    // more than what's left in today's budget. (The contract would revert
    // anyway — this just avoids burning gas on doomed attempts.)
    const cap = treasuryState.policy.maxPerTx < treasuryState.remainingToday
      ? treasuryState.policy.maxPerTx
      : treasuryState.remainingToday;
    const amount = needed < cap ? needed : cap;

    if (amount === 0n) {
      log("rebalance needed but daily budget exhausted — deferring to next window");
    } else {
      log(`rebalancing: sending $${formatUsd(amount)} treasury → worker…`);
      const res = await sdk.transferWithReceipt(treasury, worker, amount, `rebalance-loop-${loop}`);
      log(
        `  settled in ${res.finalityMs}ms | fee $${formatUsd(res.feeUsdc)} | ` +
          `receipt ${res.receiptId ?? "n/a"} | https://testnet.arcscan.app/tx/${res.hash}`
      );
    }
  }

  if (loop % HEARTBEAT_EVERY === 0) {
    const hb = await sdk.heartbeat(treasury);
    log(`heartbeat confirmed in ${hb.finalityMs}ms`);
  }
}

async function main() {
  log("AgentSettle rebalancer starting (ctrl-c to stop)");
  log(`treasury=${treasury} worker=${worker} agentKey=${sdk.agentAccount?.address}`);

  // Simple resilient loop: exponential backoff on repeated failures so a
  // policy revert or RPC blip never crashes the agent.
  for (;;) {
    try {
      await tick();
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      const backoff = Math.min(consecutiveFailures * 10_000, 60_000);
      log(`tick failed (${(err as Error).message.slice(0, 200)}) — backing off ${backoff / 1000}s`);
      await new Promise((r) => setTimeout(r, backoff));
    }
    await new Promise((r) => setTimeout(r, LOOP_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
