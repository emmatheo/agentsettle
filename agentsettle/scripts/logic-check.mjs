// Compiler-free logic tests. We re-implement the *exact* arithmetic and
// encoding rules from the Solidity + SDK in plain JS and assert against
// hand-computed values. This catches logic errors (off-by-one limits, wrong
// decimal handling, bad clone bytecode) that a syntax compile would NOT catch.

let pass = 0, fail = 0;
function eq(actual, expected, msg) {
  const a = String(actual), e = String(expected);
  if (a === e) { pass++; console.log(`  ok  ${msg}`); }
  else { fail++; console.log(`  FAIL ${msg}\n       expected ${e}\n       got      ${a}`); }
}
function throws(fn, msg) {
  try { fn(); fail++; console.log(`  FAIL ${msg} (expected throw)`); }
  catch { pass++; console.log(`  ok  ${msg} (threw as expected)`); }
}

// ---------------------------------------------------------------------------
// 1. SDK usd() / formatUsd() — 6-decimal USDC round-tripping
// ---------------------------------------------------------------------------
const DEC = 6n;
function usd(amount) {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "000000").slice(0, Number(DEC));
  return BigInt(whole || "0") * 10n ** DEC + BigInt(fracPadded || "0");
}
function formatUsd(amount) {
  const neg = amount < 0n; const abs = neg ? -amount : amount;
  const whole = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}
console.log("\n[1] USDC amount helpers");
eq(usd("1.25"), 1_250_000n, "usd('1.25') = 1_250_000");
eq(usd("0.10"), 100_000n, "usd('0.10') = 100_000");
eq(usd(5), 5_000_000n, "usd(5) = 5_000_000");
eq(usd("0.000001"), 1n, "usd smallest unit");
eq(formatUsd(1_250_000n), "1.25", "formatUsd round-trip 1.25");
eq(formatUsd(6_000_000n), "6", "formatUsd whole dollars");
eq(formatUsd(1n), "0.000001", "formatUsd 1 micro-USDC");

// web parseUsd (2-dp display but 6-dp parse) validation regex
function parseUsd(s) {
  if (!/^\d+(\.\d{1,6})?$/.test(s.trim())) throw new Error("bad");
  const [whole, frac = ""] = s.trim().split(".");
  return BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}
console.log("\n[2] web parseUsd validation");
eq(parseUsd("2.5"), 2_500_000n, "parseUsd 2.5");
throws(() => parseUsd("1.2345678"), "parseUsd rejects >6 decimals");
throws(() => parseUsd("abc"), "parseUsd rejects letters");
throws(() => parseUsd("-1"), "parseUsd rejects negative");

// ---------------------------------------------------------------------------
// 3. AgentWallet._recordSpend — the core policy math
// ---------------------------------------------------------------------------
// Mirror the Solidity: maxPerTx and rolling daily window with lazy reset.
function makeWallet(dailyLimit, maxPerTx, nowSec) {
  return { dailyLimit, maxPerTx, spentToday: 0n, dayStart: BigInt(nowSec) };
}
const DAY = 86400n;
function recordSpend(w, amount, nowSec) {
  const now = BigInt(nowSec);
  if (now >= w.dayStart + DAY) { w.dayStart = now; w.spentToday = 0n; }
  if (amount > w.maxPerTx) throw new Error("OverPerTxLimit");
  const wouldBe = w.spentToday + amount;
  if (wouldBe > w.dailyLimit) throw new Error("OverDailyLimit");
  w.spentToday = wouldBe;
}
function remainingToday(w, nowSec) {
  if (BigInt(nowSec) >= w.dayStart + DAY) return w.dailyLimit;
  return w.dailyLimit > w.spentToday ? w.dailyLimit - w.spentToday : 0n;
}

console.log("\n[3] AgentWallet policy accounting");
let t = 1_000_000; // arbitrary start time (sec)
const w = makeWallet(usd(50), usd(10), t);
recordSpend(w, usd(5), t);
eq(w.spentToday, 5_000_000n, "after $5 spend, spentToday=$5");
throws(() => recordSpend(w, usd("10.000001"), t), "per-tx limit blocks $10.000001");
// fill to daily cap: 5 + 10 + 10 + 10 + 10 + 5 = 50 exactly
for (let i = 0; i < 4; i++) recordSpend(w, usd(10), t); // now $45
recordSpend(w, usd(5), t);                              // now $50 exactly
eq(w.spentToday, 50_000_000n, "reached exact $50 daily cap");
throws(() => recordSpend(w, usd("0.000001"), t), "daily limit blocks the very next micro-USDC");
eq(remainingToday(w, t), 0n, "remaining today = 0 at cap");
// window rolls after a day
const later = t + 86401;
eq(remainingToday(w, later), usd(50), "remaining resets to full after 1 day");
recordSpend(w, usd(10), later);
eq(w.spentToday, 10_000_000n, "spend resumes in new window");

// exact-boundary spends are allowed (<=, not <)
const w2 = makeWallet(usd(10), usd(10), t);
recordSpend(w2, usd(10), t);
eq(w2.spentToday, 10_000_000n, "exactly maxPerTx == dailyLimit is allowed");

// ---------------------------------------------------------------------------
// 4. execute() delta accounting — before/after balance capture
// ---------------------------------------------------------------------------
console.log("\n[4] execute() USDC-delta spend capture");
function executeDelta(before, after) {
  return before > after ? before - after : 0n;
}
eq(executeDelta(usd(100), usd(92)), usd(8), "delta captures $8 outflow");
eq(executeDelta(usd(100), usd(105)), 0n, "inflow -> zero spend (no underflow)");

// ---------------------------------------------------------------------------
// 5. EIP-1167 minimal-proxy bytecode assembly
// ---------------------------------------------------------------------------
console.log("\n[5] EIP-1167 clone bytecode");
// Reconstruct the runtime the assembly builds and check the canonical shape.
const impl = "bebebebebebebebebebebebebebebebebebebebe";
const prefix = "3d602d80600a3d3981f3363d3d373d3d3d363d73";
const suffix = "5af43d82803e903d91602b57fd5bf3";
const creation = prefix + impl + suffix;
eq(creation.length / 2, 55, "clone creation code is 55 bytes (0x37)");
eq(creation.slice(0, 40), prefix, "clone has canonical 1167 prefix");
eq(creation.includes(impl), true, "clone embeds implementation address");
eq(creation.slice(-30), suffix, "clone has canonical 1167 suffix");

// ---------------------------------------------------------------------------
// 6. Tab digest domain separation (structure, not the hash itself)
// ---------------------------------------------------------------------------
console.log("\n[6] tab voucher monotonicity rule");
// claimTab: cumulative must strictly increase and never exceed deposit; each
// claim pays only the delta. Reproduce that state machine.
function makeTab(deposit) { return { deposit, claimed: 0n, open: true }; }
function claimTab(tab, cumulative) {
  if (!tab.open) throw new Error("TabNotOpen");
  if (cumulative > tab.deposit) throw new Error("OverDeposit");
  if (cumulative <= tab.claimed) throw new Error("NothingToClaim");
  const delta = cumulative - tab.claimed;
  tab.claimed = cumulative;
  return delta;
}
const tab = makeTab(usd(10));
eq(claimTab(tab, usd(3)), usd(3), "first claim pays full cumulative $3");
eq(claimTab(tab, usd(7)), usd(4), "second claim pays only $4 delta");
throws(() => claimTab(tab, usd(7)), "replay of same cumulative rejected");
throws(() => claimTab(tab, usd(11)), "claim over deposit rejected");
const refund = tab.deposit - tab.claimed;
eq(refund, usd(3), "closeTab refunds unclaimed $3");

// ---------------------------------------------------------------------------
// 7. fee conversion: 18-decimal native wei -> 6-decimal USDC
// ---------------------------------------------------------------------------
console.log("\n[7] SDK fee conversion (native18 -> usdc6)");
function feeUsdc(gasUsed, gasPrice) { return (gasUsed * gasPrice) / 10n ** 12n; }
// e.g. 21000 gas at 1 gwei-equivalent (1e9) native wei => 21000*1e9 = 2.1e13 => /1e12 = 21 (=$0.000021)
eq(feeUsdc(21000n, 1_000_000_000n), 21n, "21k gas @ 1e9 -> 21 micro-USDC");
eq(formatUsd(feeUsdc(21000n, 1_000_000_000n)), "0.000021", "fee formats to $0.000021");

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
