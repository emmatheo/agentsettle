import { defineChain } from "viem";

/**
 * Arc Testnet, defined explicitly.
 *
 * Recent viem versions ship `arcTestnet` as a built-in, but pinning our own
 * definition means the SDK works regardless of the installed viem version —
 * no surprise `undefined` import if a lockfile resolves an older viem. Values
 * match Arc's official "Connect to Arc" docs.
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});
