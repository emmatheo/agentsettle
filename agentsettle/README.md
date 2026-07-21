# AgentSettle

**Policy-scoped USDC wallets and machine-to-machine settlement for autonomous agents, on Arc.**

AgentSettle lets an autonomous agent hold real dollars safely. The owner deploys a smart contract wallet with hard, on-chain rules — daily spend limit, max per transaction, an allow-list of counterparties, and an expiry date — and hands the agent a hot key. The agent then pays, escrows, and streams nanopayments with real USDC, and *cannot* exceed its mandate: the chain, not the agent's code, enforces the rules. Everything runs live on Arc Testnet with real testnet USDC. There is no mock data anywhere in this repo.

```
agentsettle/
├── contracts/            Foundry project (Solidity 0.8.24, zero external deps)
│   ├── src/
│   │   ├── AgentWallet.sol          per-agent wallet: policy-checked execute/pay
│   │   ├── AgentWalletFactory.sol   EIP-1167 clone factory
│   │   ├── SettlementModule.sol     escrow · nanopayment tabs · receipts
│   │   ├── AgentRegistry.sol        discovery + capability bitmap + heartbeats
│   │   └── interfaces/IERC20.sol
│   ├── script/Deploy.s.sol
│   └── test/AgentSettle.t.sol       14 tests incl. policy-revert paths
├── sdk/                  TypeScript SDK (viem)
│   ├── src/index.ts                 createAgentWallet / fundAgent / executeAgentAction / …
│   └── examples/cctp-bridge.ts      CCTP V2: Arc → Base Sepolia burn-and-mint
├── agent/                Autonomous demo agent
│   ├── src/setup.ts                 deploys + funds + registers a 2-wallet fleet
│   └── src/rebalancer.ts            infinite loop: monitor → rebalance → heartbeat
└── web/                  Next.js 14 dashboard (wagmi + viem + Tailwind)
```

## Why Arc (submission notes)

**USDC is gas.** Agents hold exactly one asset. There is no "keep some ETH around for gas" bootstrapping problem, no second faucet, no gas-price oracle in the agent loop. An AgentWallet's entire risk surface is one balance with one policy over it — the SDK even reports every transaction's fee in dollars (`feeUsdc`), because on Arc fees *are* dollars.

**Sub-second deterministic finality.** The rebalancer measures wall-clock time from `sendTransaction` to confirmed receipt and logs it on every action; the dashboard renders the same number as a green "final in _N_ ms" readout on every deploy, payment, and policy change. Deterministic finality (Malachite consensus, no reorgs) is what makes machine-to-machine commerce sane: the moment a `Receipt` event exists, the counterparty agent can release the deliverable. No confirmation counting.

**Predictable fees make nanopayments real.** `SettlementModule` tabs let a payer sign off-chain vouchers for cumulative cents-scale amounts, settled in a single on-chain claim that costs a stable fraction of a cent. That economics only closes when fees are flat and dollar-denominated.

**Arc's native-USDC model enables one-line spend accounting.** Because the native gas asset and the ERC-20 at `0x3600…0000` share a single underlying balance, `AgentWallet.execute` enforces the spend policy by snapshotting one ERC-20 `balanceOf` around the call — this single delta provably captures both native-value sends and token transfers. On any other EVM chain this guarantee needs two measurements in two decimal systems.

**Circle-stack integration.** CCTP V2 (Arc domain 26) example included for moving agent liquidity in from Base Sepolia / Ethereum Sepolia (`sdk/examples/cctp-bridge.ts`, Iris sandbox attestation polling). On Paymaster: Circle's Paymaster exists to let users pay gas in USDC on chains where gas isn't USDC — on Arc that property is native, so AgentSettle needs no Paymaster on-chain; the honest integration story is "Arc makes the Paymaster redundant," and the CCTP example is where agents would use Paymaster-style flows on *other* chains.

## Prerequisites

Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`), Node.js ≥ 18, and MetaMask. On Windows, run Foundry inside WSL or Git Bash; Node/Next.js work fine in PowerShell.

Get testnet USDC: https://faucet.circle.com → network **Arc Testnet** → 10 USDC per request. You'll want ~2 requests (owner key + a dollar for the agent hot key's gas).

Arc Testnet network settings (MetaMask adds these automatically via the dashboard's "Switch to Arc" button): RPC `https://rpc.testnet.arc.network`, chain ID `5042002`, currency `USDC`, explorer `https://testnet.arcscan.app`.

## 1. Build and test the contracts

```bash
cd contracts
forge install foundry-rs/forge-std   # only dependency: the test/script stdlib
forge build
forge test -vv
```

The test suite plants a mock ERC-20 at Arc's USDC system address (`deployCodeTo`) so all production bytecode — which hard-codes `0x3600…0000` — runs unmodified on local Anvil. Tests cover per-tx limits, daily-window rollover, target allow-listing, the agent's ban on calling USDC directly (approval-drain prevention), expiry, escrow release/refund, tab vouchers with forged-signature rejection, receipts, and registry lifecycle.

## 2. Deploy to Arc Testnet

```bash
cd contracts
export PRIVATE_KEY=0x...   # owner key, funded from the faucet
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast -vvv
```

Copy the three logged addresses (factory, settlement, registry) into `agent/.env` and `web/.env.local` (see the `.env.example` files). The whole stack deploys for well under $0.10 of testnet USDC — note the exact dollar cost in the broadcast output; that predictability is an Arc talking point in the demo.

## 3. Run the dashboard

```bash
cd web
npm install
cp .env.example .env.local   # paste the three deployed addresses
npm run dev                  # http://localhost:3000
```

Connect MetaMask → the button offers "Switch to Arc" and adds the network automatically. From here you can deploy agent wallets, fund them, edit rules, trigger test payments, and watch the live event feed. Every confirmed action shows its measured settlement latency.

## 4. Run the autonomous agent

```bash
cd agent
npm install
cp .env.example .env         # owner key, a fresh agent key, deployed addresses
npm run setup                # deploys TREASURY + WORKER wallets, funds, registers
# paste the two printed wallet addresses into .env, then:
npm run start
```

The rebalancer loops forever: it reads the worker wallet's balance, and when it drops below $0.50 it tops it up to $1.50 from the treasury via `transferWithReceipt` — a real on-chain transfer with a receipt event both agents can verify — logging finality latency and the exact USDC fee each time. Every fourth loop it heartbeats the registry so the dashboard shows it live. Drain the worker wallet from the dashboard ("Trigger payment") and watch the agent restore it within one loop.

The important part: the agent *proactively* caps itself at its `maxPerTx`/daily-budget, but even if you delete that code, the wallet contract reverts any overspend. Try it — set the treasury's daily limit to $0.10 in the dashboard mid-run and watch the agent's transactions start reverting with `OverDailyLimit`. Safety lives on-chain.

## 5. CCTP cross-chain example

```bash
cd sdk && npm install
export OWNER_PRIVATE_KEY=0x...   # funded on Arc; also needs Base Sepolia ETH for the mint tx
npm run cctp:example
```

Burns 1 USDC on Arc via `TokenMessengerV2.depositForBurn` (fast-transfer finality threshold), polls Circle's Iris sandbox for the attestation, then mints on Base Sepolia via `receiveMessage`. Verify the Base Sepolia USDC address in the script header against Circle's current docs before a live run.

## Demo script (3 minutes)

Open the dashboard with two browser profiles (owner in one, agent hot key imported in the other). (1) Deploy an agent wallet — point at the "final in ~400 ms" readout and the sub-cent dollar fee. (2) Fund it, set a $1 daily limit / $0.25 per-tx. (3) Start the rebalancer in a terminal; show its log settling real transfers with receipts. (4) The kill shot: from the agent-key profile, try to pay $0.50 — the chain rejects it live with `OverPerTxLimit`. (5) Close on ArcScan showing the receipt trail.

## Security model (summary)

The hot agent key is assumed compromisable; its blast radius is bounded by the policy: at most `maxPerTx` per action, `dailyLimit` per rolling day, only to allow-listed targets, only until `expiry`, and the owner can pause or rotate it instantly. The agent key cannot call the USDC contract directly, so it can never plant an allowance that drains funds outside the delta-accounted `execute` window. Approvals to the SettlementModule are owner-only. Tab vouchers are bound to contract + chain id + tab id (no cross-context replay) and s-value-normalized (no signature malleability). The implementation contract bricks its own initializer. Escrows always terminate: oracle release before the deadline, or permissionless refund after it — funds cannot strand. Known testnet-scope limitations, stated honestly: the daily window resets fully on rollover rather than sliding; event-feed lookback is 5000 blocks; the registry is unauthenticated discovery, not identity (ERC-8004 is the production path Arc documents).

---

Built solo for the Arc Programmable Money Hackathon — Agentic Economy track. Real contracts, real USDC, real sub-second settlement.
