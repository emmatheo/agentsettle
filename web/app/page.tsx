"use client";

import "./marketing.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  Gauge,
  ShieldCheck,
  KeyRound,
  Wallet,
  Network,
  SlidersHorizontal,
  Rocket,
  Copy,
  Check,
  Zap,
  Send,
  Twitter,
} from "lucide-react";
import { useProtocolStats } from "@/lib/chain-hooks";
import { CONTRACTS, short, EXPLORER } from "@/lib/contracts";
import { Mascot } from "@/components/marketing/Mascot";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Animate an integer up to `target` once it becomes available / on view. */
function useCountUp(target: number | undefined, shown: boolean) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (!shown || target === undefined || done.current) return;
    done.current = true;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, shown]);
  return target === undefined ? "—" : n.toLocaleString("en-US");
}

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] as const },
};

function CopyRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mkt-addr-row">
      <div style={{ minWidth: 0 }}>
        <div className="mkt-addr-label">{label}</div>
        <div className="mkt-addr-val" title={address}>
          {address}
        </div>
      </div>
      <button
        className="mkt-copy"
        aria-label={`Copy ${label} address`}
        onClick={() => {
          navigator.clipboard?.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function Landing() {
  const { totalWallets, totalAgents } = useProtocolStats();
  const [statsShown, setStatsShown] = useState(false);
  const wallets = useCountUp(totalWallets !== undefined ? Number(totalWallets) : undefined, statsShown);
  const agents = useCountUp(totalAgents !== undefined ? Number(totalAgents) : undefined, statsShown);

  return (
    <div className="mkt">
      {/* NAV */}
      <nav className="mkt-nav">
        <div className="mkt-shell mkt-nav-inner">
          <Link href="/" className="mkt-logo">
            <ShieldCheck size={22} color="#3dfb8f" />
            Agent<b>Settle</b>
          </Link>
          <div className="mkt-navlinks">
            <a className="mkt-navlink" href="#why">Why</a>
            <a className="mkt-navlink" href="#settlement">Settlement</a>
            <a className="mkt-navlink" href="#deploy">Deploy</a>
            <a className="mkt-navlink" href="#contracts">Contracts</a>
          </div>
          <div className="mkt-nav-right">
            <span className="mkt-status">
              <span className="mkt-dot" /> Arc Testnet · Online
            </span>
            <Link href="/app" className="mkt-btn mkt-btn--primary">
              Launch App <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="mkt-shell">
        <div className="mkt-hero">
          <div className="mkt-hero-copy">
            <span className="mkt-kicker">On-chain guardrails · Arc</span>
            <div className="mkt-hero-h1-wrap">
              <h1 className="mkt-h1">
                Guardrails for money that moves at <em>machine&nbsp;speed.</em>
              </h1>
            </div>
            <p className="mkt-lede">
              AgentSettle gives autonomous agents policy-scoped USDC wallets on Arc — hard on-chain
              limits a hot key can never exceed, and settlement that finalizes in well under a second.
            </p>
            <div className="mkt-cta-row">
              <Link href="/app" className="mkt-btn mkt-btn--primary">
                Launch App <ArrowRight size={15} />
              </Link>
              <Link href="/app" className="mkt-btn mkt-btn--ghost">
                See a live settlement <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="mkt-trust">
              <span><ShieldCheck size={14} color="#3dfb8f" /> Non-custodial</span>
              <span><Gauge size={14} color="#3dfb8f" /> Sub-second finality</span>
              <span><Lock size={14} color="#3dfb8f" /> Enforced by contract</span>
            </div>
          </div>

          <motion.div
            className="mkt-hero-visual"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            onViewportEnter={() => setStatsShown(true)}
          >
            <div className="mkt-mascot-stage">
              <Mascot className="mkt-mascot" />
            </div>
            <div className="mkt-stat-row">
              <div className="mkt-statcard">
                <div className="mkt-stat-label">Total Agent Wallets</div>
                <div className="mkt-stat-value"><b>{wallets}</b></div>
              </div>
              <div className="mkt-statcard">
                <div className="mkt-stat-label">Registered Agents</div>
                <div className="mkt-stat-value"><b>{agents}</b></div>
              </div>
            </div>
            <div className="mkt-trust" style={{ paddingTop: 0, justifyContent: "space-between" }}>
              <span><Zap size={13} color="#3dfb8f" /> Live from the Arc Testnet contracts</span>
              <span>deterministic · no reorg</span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* WHY */}
      <section id="why" className="mkt-shell mkt-section">
        <motion.div className="mkt-head" {...reveal}>
          <span className="mkt-kicker">Why AgentSettle</span>
          <h2 className="mkt-h2">Custody your agents can&rsquo;t <em>overspend.</em></h2>
          <p className="mkt-lede">
            Give an agent a key, not your treasury. Every wallet enforces its spending policy in the
            contract itself — so autonomy never means unbounded risk.
          </p>
        </motion.div>

        <div className="mkt-why">
          <motion.article className="mkt-feature mkt-feature--lg" {...reveal}>
            <div>
              <span className="mkt-feature-icon"><KeyRound size={22} /></span>
              <h3>Policy-scoped wallets</h3>
              <p>
                Each agent wallet carries a daily limit, a max-per-transaction cap, and a hot-key
                expiry — all enforced on-chain. The agent&rsquo;s key physically cannot move a cent
                beyond the policy you set, no matter what the model decides to do.
              </p>
            </div>
            <span className="mkt-feature-num">01</span>
          </motion.article>

          <motion.article className="mkt-feature" {...reveal} transition={{ ...reveal.transition, delay: 0.05 }}>
            <span className="mkt-feature-icon"><Gauge size={22} /></span>
            <h3>Sub-second settlement</h3>
            <p>
              On Arc, machine-to-machine transfers reach deterministic finality in well under a
              second. No reorgs, no confirmations to wait on — the receipt is final.
            </p>
          </motion.article>

          <motion.article className="mkt-feature" {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
            <span className="mkt-feature-icon"><ShieldCheck size={22} /></span>
            <h3>Non-custodial control</h3>
            <p>
              You stay the owner. Pause, drain, or re-scope any wallet at any moment — the agent only
              ever holds a revocable hot key, never your funds.
            </p>
          </motion.article>
        </div>
      </section>

      {/* SETTLEMENT PRIMITIVES */}
      <section id="settlement" className="mkt-shell mkt-section mkt-grid-bg">
        <motion.div className="mkt-head mkt-head--offset" {...reveal}>
          <span className="mkt-kicker">How settlement works</span>
          <h2 className="mkt-h2">Three primitives, one <em>ledger.</em></h2>
          <p className="mkt-lede" style={{ marginLeft: "auto" }}>
            The settlement module gives agents the exact instrument each job needs — from held escrow
            to metered streams to instant atomic pay.
          </p>
        </motion.div>

        <div className="mkt-prims">
          {[
            {
              t: "Conditional Escrow",
              d: "Funds lock until an oracle attests delivery, then release instantly. If the condition isn't met by the deadline, the escrow auto-refunds the payer — money can never strand.",
              tag: "Escrow",
            },
            {
              t: "Nanopayment Tabs",
              d: "Meter usage off-chain with signed vouchers, then settle the entire running tab in a single on-chain transaction. Pay-per-call without a transaction per call.",
              tag: "Streaming",
            },
            {
              t: "Atomic Transfer",
              d: "Machine-to-machine USDC settlement with an auto-generated, verifiable receipt and its real measured latency. One call, deterministic finality.",
              tag: "M2M",
            },
          ].map((p, i) => (
            <motion.div className="mkt-prim" key={p.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }}>
              <span className="mkt-prim-idx">0{i + 1}</span>
              <div className="mkt-prim-body">
                <h3>{p.t}</h3>
                <p>{p.d}</p>
              </div>
              <span className="mkt-prim-tag">{p.tag}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* DEPLOY STEPS */}
      <section id="deploy" className="mkt-shell mkt-section">
        <motion.div className="mkt-head" {...reveal}>
          <span className="mkt-kicker">Deploy in four steps</span>
          <h2 className="mkt-h2">From wallet to live agent in <em>one transaction.</em></h2>
        </motion.div>

        <div className="mkt-steps">
          {[
            { n: "01", icon: <Wallet size={18} />, t: "Connect MetaMask", d: "Bring any injected wallet. AgentSettle runs on the Arc Testnet — no new accounts, no sign-up.", cta: "Launch app", href: "/app" },
            { n: "02", icon: <Network size={18} />, t: "Switch to Arc", d: "One tap adds and switches to Arc Testnet; the app passes the full chain config to your wallet.", cta: "View network", href: EXPLORER },
            { n: "03", icon: <SlidersHorizontal size={18} />, t: "Set policy limits", d: "Choose a daily limit, a max-per-transaction cap, and how long the agent's hot key stays valid.", cta: "Configure", href: "/app" },
            { n: "04", icon: <Rocket size={18} />, t: "Deploy the wallet", d: "One real transaction mints a policy-scoped smart wallet. Fund it, hand the agent its key — it's live.", cta: "Deploy now", href: "/app" },
          ].map((s, i) => (
            <motion.article
              className="mkt-step"
              key={s.n}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.06 }}
            >
              <span className="mkt-step-num">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              <Link href={s.href} className="mkt-step-link" target={s.href.startsWith("http") ? "_blank" : undefined}>
                {s.icon} {s.cta} <ArrowRight size={13} />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      {/* CONTRACTS */}
      <section id="contracts" className="mkt-shell mkt-section">
        <motion.div className="mkt-head" {...reveal}>
          <span className="mkt-kicker">Verify it yourself</span>
          <h2 className="mkt-h2">Live contracts on <em>Arc Testnet.</em></h2>
          <p className="mkt-lede">
            No trust required — every wallet, policy, and settlement is enforced by these deployed
            contracts. Read them on-chain.
          </p>
        </motion.div>

        <motion.div className="mkt-addr-panel" {...reveal}>
          <CopyRow label="Factory" address={CONTRACTS.factory} />
          <CopyRow label="Settlement Module" address={CONTRACTS.settlement} />
          <CopyRow label="Registry" address={CONTRACTS.registry} />
          <div style={{ marginTop: "var(--space-md)" }}>
            <a
              className="mkt-btn mkt-btn--ghost"
              href={`${EXPLORER}/address/${CONTRACTS.factory}`}
              target="_blank"
              rel="noreferrer"
            >
              View on ArcScan <ArrowUpRight size={15} />
            </a>
          </div>
        </motion.div>
      </section>

      {/* CTA BAND */}
      <section className="mkt-shell mkt-section">
        <motion.div className="mkt-cta" {...reveal}>
          <span className="mkt-kicker" style={{ justifyContent: "center" }}>Ready when your agents are</span>
          <h2 className="mkt-h2">Put your agents on a <em>leash.</em></h2>
          <p className="mkt-lede" style={{ marginInline: "auto" }}>
            Deploy a policy-scoped wallet, fund it with test USDC, and watch a real settlement finalize
            in milliseconds.
          </p>
          <div className="mkt-cta-row">
            <Link href="/app" className="mkt-btn mkt-btn--primary">
              Launch App <ArrowRight size={15} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="mkt-footer">
        <div className="mkt-shell">
          <div className="mkt-footer-inner">
            <Link href="/" className="mkt-logo">
              <ShieldCheck size={20} color="#3dfb8f" />
              Agent<b>Settle</b>
            </Link>
            <div className="mkt-footer-links">
              <a className="mkt-navlink" href="#why">Why</a>
              <a className="mkt-navlink" href="#settlement">Settlement</a>
              <a className="mkt-navlink" href="#deploy">Deploy</a>
              <Link className="mkt-navlink" href="/app">Launch App</Link>
            </div>
          </div>
          <div className="mkt-foot-note">
            <span>© {new Date().getFullYear()} AgentSettle · Running on Arc Testnet</span>
            <span style={{ display: "inline-flex", gap: "var(--space-sm)" }}>
              <a className="mkt-navlink" href={EXPLORER} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Twitter size={14} /> Updates
              </a>
              <a className="mkt-navlink" href={EXPLORER} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Send size={14} /> Community
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
