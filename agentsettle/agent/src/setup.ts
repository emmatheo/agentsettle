/**
 * One-time demo setup. Creates the two-wallet fleet the rebalancer manages:
 *
 *   TREASURY wallet — holds the float ($8 from the faucet allocation)
 *   WORKER wallet   — spends on "work" and gets topped up by the agent
 *
 * Both are real AgentWallet contracts on Arc Testnet with real USDC.
 *
 * Prereqs:
 *   - contracts deployed (contracts/script/Deploy.s.sol) and addresses exported
 *   - OWNER_PRIVATE_KEY funded from https://faucet.circle.com (Arc Testnet)
 *   - AGENT_PRIVATE_KEY generated (any fresh key; needs a little USDC for gas)
 *
 * Run: npm run setup
 * Then copy the printed TREASURY_WALLET / WORKER_WALLET into agent/.env.
 */
import "dotenv/config";
import { AgentSettleSDK, usd, formatUsd, CAPABILITY } from "@agentsettle/sdk";

async function main() {
  const sdk = new AgentSettleSDK();
  if (!sdk.agentAccount) throw new Error("Set AGENT_PRIVATE_KEY in agent/.env");
  const agentAddr = sdk.agentAccount.address;
  const weekFromNow = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);

  console.log("Deploying TREASURY wallet…");
  const treasury = await sdk.createAgentWallet({
    agent: agentAddr,
    policy: { dailyLimit: usd(5), maxPerTx: usd(2), expiry: weekFromNow, active: true },
  });
  console.log(`  ${treasury.wallet}  (confirmed in ${treasury.finalityMs}ms, fee $${formatUsd(treasury.feeUsdc)})`);

  console.log("Deploying WORKER wallet…");
  const worker = await sdk.createAgentWallet({
    agent: agentAddr,
    policy: { dailyLimit: usd(3), maxPerTx: usd(1), expiry: weekFromNow, active: true },
  });
  console.log(`  ${worker.wallet}  (confirmed in ${worker.finalityMs}ms, fee $${formatUsd(worker.feeUsdc)})`);

  // The treasury agent needs the worker as an allowed pay target, and both
  // wallets need the SettlementModule approved for receipt-based transfers.
  console.log("Allow-listing worker as a treasury pay target…");
  await sdk.setTarget(treasury.wallet, worker.wallet, true);

  console.log("Approving SettlementModule from treasury (owner-level)…");
  await sdk.approveSettlement(treasury.wallet, usd(100));

  console.log("Funding treasury with $6 USDC…");
  const fund = await sdk.fundAgent(treasury.wallet, usd(6));
  console.log(`  funded (confirmed in ${fund.finalityMs}ms)`);

  console.log("Registering both wallets in the AgentRegistry…");
  await sdk.registerAgent(treasury.wallet, "https://agentsettle.example/agents/treasury.json", CAPABILITY.PAYMENTS | CAPABILITY.REBALANCER);
  await sdk.registerAgent(worker.wallet, "https://agentsettle.example/agents/worker.json", CAPABILITY.PAYMENTS);

  console.log("\nAdd these to agent/.env:");
  console.log(`TREASURY_WALLET=${treasury.wallet}`);
  console.log(`WORKER_WALLET=${worker.wallet}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
