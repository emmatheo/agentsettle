# Compiler-free logic checks

`node scripts/logic-check.mjs` — validates the core arithmetic and encoding
rules (USDC decimal handling, agent spend-policy accounting, tab voucher
monotonicity, EIP-1167 clone bytecode shape, fee conversion) with zero
dependencies and no network. Run it any time; it should print
`32 passed, 0 failed`. This is a fast smoke test of the *logic* — it does not
replace `forge test`, which validates the actual compiled contracts.
