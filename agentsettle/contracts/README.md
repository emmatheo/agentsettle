# AgentSettle contracts

## Deploying via Remix (recommended, no installs)
Open https://remix.ethereum.org and import ONLY the `src/` folder:
```
src/interfaces/IERC20.sol
src/AgentWallet.sol
src/AgentWalletFactory.sol
src/SettlementModule.sol
src/AgentRegistry.sol
```
Do NOT import `test/` or `script/` in Remix — those are Foundry-only and import
`forge-std`, which doesn't exist in Remix (you'll see harmless `ds-test`/`forge-std`
"File not found" errors if you do). Full walkthrough: ../REMIX-DEPLOY.md

Compiler settings in Remix: version 0.8.24, optimization ON, runs 800.
Deploy order: AgentWalletFactory, then SettlementModule, then AgentRegistry.

## Deploying via Foundry (alternative)
```
forge install foundry-rs/forge-std
forge build
forge test -vv
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
```
