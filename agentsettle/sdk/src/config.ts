/**
 * AgentSettle — Arc Testnet configuration.
 *
 * Every address below is verified against Arc's official contract-address
 * reference (docs.arc.io/arc/references/contract-addresses).
 */

/** Arc Testnet chain id. */
export const ARC_CHAIN_ID = 5042002;

/** Default public RPC. Override with ARC_RPC_URL if you have a dedicated one. */
export const ARC_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_WS_URL = "wss://rpc.testnet.arc.network";

/** Block explorer. */
export const ARC_EXPLORER = "https://testnet.arcscan.app";

/**
 * USDC on Arc: the NATIVE gas asset, with an ERC-20 facade at this system
 * address. The ERC-20 view uses 6 decimals and shares its balance with the
 * native (18-decimal) view. The SDK talks exclusively to the ERC-20 facade,
 * per Arc's own guidance, so every amount in this SDK is 6-decimal USDC.
 */
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;

/** Arc's predeployed Memo extension (optional tx memo events). */
export const ARC_MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505" as const;

/** Multicall3 (standard address, predeployed on Arc). */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

/**
 * CCTP V2 on Arc Testnet — Circle's canonical burn-and-mint bridge.
 * Arc's CCTP domain is 26. The V2 testnet contracts share the same addresses
 * across EVM testnets (Arc, Base Sepolia, Ethereum Sepolia, …).
 */
export const CCTP = {
  ARC_DOMAIN: 26,
  BASE_SEPOLIA_DOMAIN: 6,
  ETH_SEPOLIA_DOMAIN: 0,
  TOKEN_MESSENGER_V2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as const,
  MESSAGE_TRANSMITTER_V2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const,
  /** Circle attestation service (testnet sandbox). */
  IRIS_API: "https://iris-api-sandbox.circle.com",
} as const;

/**
 * AgentSettle deployment addresses. Populated from environment so the same
 * SDK build works against any deployment. Set these after running
 * contracts/script/Deploy.s.sol.
 */
export interface AgentSettleAddresses {
  factory: `0x${string}`;
  settlement: `0x${string}`;
  registry: `0x${string}`;
}

export function addressesFromEnv(env: Record<string, string | undefined> = process.env): AgentSettleAddresses {
  const factory = env.AGENTSETTLE_FACTORY;
  const settlement = env.AGENTSETTLE_SETTLEMENT;
  const registry = env.AGENTSETTLE_REGISTRY;
  if (!factory || !settlement || !registry) {
    throw new Error(
      "Missing AGENTSETTLE_FACTORY / AGENTSETTLE_SETTLEMENT / AGENTSETTLE_REGISTRY env vars. " +
        "Deploy contracts first (see contracts/script/Deploy.s.sol) and export the logged addresses."
    );
  }
  return {
    factory: factory as `0x${string}`,
    settlement: settlement as `0x${string}`,
    registry: registry as `0x${string}`,
  };
}

/** Capability bit flags used by the demo (app-defined, extend freely). */
export const CAPABILITY = {
  PAYMENTS: 1n,
  ORACLE: 2n,
  REBALANCER: 4n,
  ESCROW_ARBITER: 8n,
} as const;
