import { parseAbi, keccak256, toBytes, type Address, type Hex, type AbiEvent } from "viem";

/**
 * Live AgentSettle deployment on Arc Testnet.
 * These three addresses were deployed via Remix and confirmed by the operator.
 */
export const CONTRACTS = {
  factory: "0xF3fc7D5cB272BB5d455076fA619c97d2Bc1a1f5F" as Address,
  settlement: "0xC23B7F3C78ad63F07f6BC5EBC1f3Dd6Aa51927a3" as Address,
  registry: "0x4eAd0195b610F3b4daD25dF3B5E86878916fEDB5" as Address,
};

/** Arc's native-USDC ERC-20 facade (6 decimals). */
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address;
export const EXPLORER = "https://testnet.arcscan.app";

// ---------------------------------------------------------------------------
// ABIs (human-readable, kept in lock-step with contracts/src)
// ---------------------------------------------------------------------------

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const factoryAbi = parseAbi([
  "struct Policy { uint128 dailyLimit; uint128 maxPerTx; uint64 expiry; bool active; }",
  "function deployAgentWallet(address agent, Policy p, address[] targets) returns (address wallet)",
  "function walletsOf(address owner) view returns (address[])",
  "function totalWallets() view returns (uint256)",
  "function isAgentWallet(address) view returns (bool)",
  "event AgentWalletDeployed(address indexed wallet, address indexed owner, address indexed agent, uint128 dailyLimit, uint128 maxPerTx, uint64 expiry)",
]);

export const agentWalletAbi = parseAbi([
  "struct Policy { uint128 dailyLimit; uint128 maxPerTx; uint64 expiry; bool active; }",
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function policy() view returns (uint128 dailyLimit, uint128 maxPerTx, uint64 expiry, bool active)",
  "function spentToday() view returns (uint128)",
  "function usdcBalance() view returns (uint256)",
  "function remainingToday() view returns (uint256)",
  "function setPolicy(Policy _policy)",
  "function setTarget(address target, bool allowed)",
  "function pay(address to, uint256 amount, bytes32 memoRef)",
  "function ownerWithdraw(address to, uint256 amount)",
  "event Payment(address indexed by, address indexed to, uint256 amount, bytes32 memoRef)",
  "event Executed(address indexed by, address indexed target, uint256 value, uint256 usdcSpent, bytes4 selector)",
  "event Deposit(address indexed from, uint256 amountNative18)",
  "event OwnerWithdrawal(address indexed to, uint256 amount)",
  "event PolicyUpdated(uint128 dailyLimit, uint128 maxPerTx, uint64 expiry, bool active)",
  "event TargetAllowed(address indexed target, bool allowed)",
]);

export const registryAbi = parseAbi([
  "function totalAgents() view returns (uint256)",
]);

/** Event subset typed for viem getLogs. */
export const walletEvents = agentWalletAbi.filter((i) => i.type === "event") as AbiEvent[];

// ---------------------------------------------------------------------------
// USDC helpers (6-decimal)
// ---------------------------------------------------------------------------

/** 1_250_000n -> "1.25" */
export function formatUsdc(amount: bigint, dp = 2): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const whole = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").slice(0, dp);
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${dp > 0 ? "." + frac : ""}`;
}

/** "1.25" -> 1_250_000n. Throws on malformed input. */
export function parseUsdc(s: string): bigint {
  const clean = s.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(clean)) throw new Error(`Invalid USDC amount: ${s}`);
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

export function compactUsdc(amount: bigint): string {
  const dollars = Number(amount) / 1_000_000;
  if (dollars >= 1_000_000) return `${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `${(dollars / 1_000).toFixed(1)}K`;
  return dollars.toFixed(2);
}

export function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function memoRef(s: string): Hex {
  return keccak256(toBytes(s));
}

export function ago(tsSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - tsSec));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Countdown to an epoch-seconds expiry. */
export function countdown(expirySec: bigint): { label: string; urgent: boolean; expired: boolean } {
  const ms = Number(expirySec) * 1000 - Date.now();
  if (ms <= 0) return { label: "expired", urgent: true, expired: true };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { label: h > 0 ? `${h}h ${m}m` : `${m}m`, urgent: ms < 4 * 3_600_000, expired: false };
}
