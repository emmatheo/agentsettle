# Deploy the contracts in your browser (no installs)

This is the **easiest path** — no WSL, no Foundry, no PowerShell. You compile and
deploy the contracts entirely in the Remix IDE with MetaMask, then paste the
resulting addresses into Render. Takes about 10 minutes.

## What you need first

- **MetaMask** installed, with a fresh account holding **Arc Testnet USDC**
  (get it at https://faucet.circle.com → select **Arc Testnet**). Request twice.
- Arc Testnet added to MetaMask. If it isn't yet, our dashboard's "Switch to Arc"
  button adds it — or add it manually:
  - Network name: `Arc Testnet`
  - RPC URL: `https://rpc.testnet.arc.network`
  - Chain ID: `5042002`
  - Currency symbol: `USDC`
  - Explorer: `https://testnet.arcscan.app`

## Steps

### 1. Open Remix and load the contracts
Go to **https://remix.ethereum.org**. In the File Explorer (left panel), create a
folder `contracts` and, inside it, recreate this structure by dragging the files
from the `contracts/src/` folder of the project (or copy-paste each file's
contents into a new file of the same name):

```
contracts/
├── interfaces/
│   └── IERC20.sol
├── AgentWallet.sol
├── AgentWalletFactory.sol
├── SettlementModule.sol
└── AgentRegistry.sol
```

Keep the folder layout — the `import "./interfaces/IERC20.sol"` lines depend on it.
(Tip: you can drag the whole `contracts/src` folder from your unzipped project
straight into the Remix file explorer.)

### 2. Compile
- Click the **Solidity Compiler** tab (left sidebar).
- Set the compiler version to **0.8.24**.
- Turn **on** "Enable optimization" and set runs to **800** (matches our config).
- Click **Compile AgentWalletFactory.sol**. It compiles `AgentWallet` too (imported).
- Then compile **SettlementModule.sol** and **AgentRegistry.sol** the same way.
- Green checkmarks = success.

### 3. Connect MetaMask to Arc
- Click the **Deploy & Run Transactions** tab.
- In the **Environment** dropdown, choose **Injected Provider - MetaMask**.
- MetaMask pops up — approve, and make sure it's on **Arc Testnet** (5042002).
  Remix should show your account and its USDC balance.

### 4. Deploy the three contracts (in this order)
For each one: pick it in the **Contract** dropdown, then click the orange
**Deploy** button and confirm in MetaMask. Each costs a fraction of a cent.

1. **AgentWalletFactory** — Deploy. (Its constructor also creates the AgentWallet
   logic contract automatically — nothing extra to do.)
2. **SettlementModule** — Deploy.
3. **AgentRegistry** — Deploy.

After each deploy, the contract appears under **Deployed Contracts** at the bottom.
Click the **copy** icon next to each name to copy its address.

### 5. Record the three addresses
You now have:
```
AgentWalletFactory  = 0x........
SettlementModule    = 0x........
AgentRegistry       = 0x........
```
Keep these — they go into Render (frontend) and `agent/.env` (if you run the agent).
Verify any of them at `https://testnet.arcscan.app/address/<paste-address>`.

That's it — the contracts are live on Arc. Continue to **RENDER-DEPLOY.md**.

---

### Alternative: command-line deploy (Foundry)
If you prefer the terminal (WSL or Git Bash on Windows):
```bash
cd contracts
forge install foundry-rs/forge-std
forge build
forge test -vv                       # optional but recommended: proves it works
export PRIVATE_KEY=0xYOUR_FUNDED_KEY
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast -vvv
```
The three addresses print at the end. Same result as the Remix path.
