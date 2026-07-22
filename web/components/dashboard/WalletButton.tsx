"use client";

import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet, ChevronDown } from "lucide-react";
import { arcTestnet } from "@/lib/wagmi";
import { short } from "@/lib/contracts";

/**
 * Real wallet connection (MetaMask / injected) via wagmi, styled for the
 * terminal. Shows the connected address and native USDC gas balance. If the
 * wallet is on the wrong network, offers a one-tap switch to Arc — wagmi passes
 * the full Arc chain definition so MetaMask adds it automatically.
 */
export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: bal } = useBalance({ address, chainId: arcTestnet.id, query: { enabled: isConnected } });

  if (!isConnected) {
    return (
      <button className="btn-arc" disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
        <Wallet size={15} />
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  if (chainId !== arcTestnet.id) {
    return (
      <button className="btn border border-warn/40 bg-warn/10 text-warn" disabled={switching} onClick={() => switchChain({ chainId: arcTestnet.id })}>
        {switching ? "Switching…" : "Switch to Arc"}
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      title="Disconnect"
      className="btn-glass group"
    >
      <span className="flex items-center gap-2 font-mono text-2xs">
        <span className="hidden text-mute sm:inline">
          {bal ? `${Number(bal.formatted).toFixed(2)} ${bal.symbol}` : "—"}
        </span>
        <span className="h-3 w-px bg-white/[0.08] hidden sm:block" />
        {short(address!)}
        <ChevronDown size={13} className="text-faint transition-transform group-hover:translate-y-0.5" />
      </span>
    </button>
  );
}
