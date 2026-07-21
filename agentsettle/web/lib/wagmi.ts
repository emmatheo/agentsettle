"use client";

import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

/**
 * Arc Testnet, defined explicitly rather than imported from wagmi/chains, so
 * the app works regardless of the installed viem/wagmi version (no chance of
 * an `undefined` chain import breaking the build). Values match Arc's official
 * "Connect to Arc" docs. When MetaMask is on the wrong network, wagmi's
 * switchChain uses this definition to add Arc automatically — including the
 * USDC gas currency and ArcScan explorer.
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

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
  },
});
