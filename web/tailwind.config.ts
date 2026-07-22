import type { Config } from "tailwindcss";

/**
 * AgentSettle "guardrail terminal" tokens.
 *
 * The palette is disciplined: a near-black field, glass panels, and exactly
 * three semantic accents — Arc cyan for the brand/primary, emerald for
 * healthy/settled, red for blocked/danger — plus amber reserved only for the
 * "limit reached" edge state. Nothing else gets a color, so the accents always
 * mean something.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#090A0F",
        raised: "#0E1017",
        arc: { DEFAULT: "#00F0FF", dim: "#0891A0" },
        ok: "#10B981",
        danger: "#EF4444",
        warn: "#F59E0B",
        fg: "#E8ECF5",
        mute: "#8B93A7",
        faint: "#565E73",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "0.875rem" }] },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,240,255,0.25), 0 0 24px -6px rgba(0,240,255,0.35)",
        "glow-ok": "0 0 0 1px rgba(16,185,129,0.25), 0 0 24px -8px rgba(16,185,129,0.4)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.5)" },
          "100%": { boxShadow: "0 0 0 8px rgba(16,185,129,0)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        sweep: "sweep 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
