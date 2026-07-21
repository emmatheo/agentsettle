import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AgentSettle — on-chain guardrails for autonomous financial agents",
  description:
    "A real-time command dashboard for autonomous AI agents holding USDC on Arc: policy-scoped wallets, machine-to-machine settlement, and sub-second finality.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
