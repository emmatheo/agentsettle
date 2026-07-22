# AgentSettle Dashboard — live on-chain

This dashboard reads 100% real data from the deployed AgentSettle contracts on
Arc Testnet. There is no simulated data.

Deployed contracts (Arc Testnet), wired in at lib/contracts.ts:
- AgentWalletFactory : 0xF3fc7D5cB272BB5d455076fA619c97d2Bc1a1f5F
- SettlementModule   : 0xC23B7F3C78ad63F07f6BC5EBC1f3Dd6Aa51927a3
- AgentRegistry      : 0x4eAd0195b610F3b4daD25dF3B5E86878916fEDB5

What's real:
- Protocol stats (total wallets, registered agents) — live contract reads.
- Agent fleet — enumerates YOUR wallets via factory.walletsOf(you) and reads
  each wallet's real balance, policy, spend, and expiry.
- Deploy / Fund / Pause / Drain — real signed transactions; each shows its
  genuine measured send→confirm latency ("Arc Speedometer").
- Transaction feed — real on-chain events from your wallets + the factory.

Honest notes:
- Until you connect a wallet and deploy an agent, the fleet and feed are empty.
  That's the truth of what's on-chain, not a bug.
- Latency badges only appear for transactions THIS dashboard sent (real
  measurement). Historical feed rows show block numbers, not fabricated latency.
- The "Settlement Modules" panel is an interactive EXPLAINER of the escrow /
  nanopayment / atomic-transfer primitives — clearly labeled as such, not a live
  data view.

No env vars needed — the addresses are hardcoded from the confirmed deployment.
