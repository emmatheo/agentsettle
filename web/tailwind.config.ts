import type { Config } from "tailwindcss";

/**
 * AgentSettle light theme tokens.
 *
 * A clean, modern SaaS palette: a white/very-light-blue field, white cards with
 * soft shadows and slate hairline borders, and a royal-blue primary accent.
 * Three semantic accents carry meaning — blue for brand/primary, emerald for
 * healthy/settled, red for blocked/danger — plus amber for the "limit reached"
 * edge state. Nothing else gets a color, so the accents always mean something.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#FFFFFF",
        raised: "#FFFFFF",
        canvas: "#F5F8FF",
        arc: { DEFAULT: "#2563EB", dim: "#1D4ED8" },
        ok: "#16A34A",
        danger: "#DC2626",
        warn: "#D97706",
        fg: "#0F172A",
        mute: "#64748B",
        faint: "#94A3B8",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "0.875rem" }] },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 10px 26px -14px rgba(15,23,42,0.14)",
        "card-hover": "0 1px 2px rgba(15,23,42,0.05), 0 16px 34px -16px rgba(37,99,235,0.28)",
        glow: "0 8px 22px -8px rgba(37,99,235,0.5)",
        "glow-ok": "0 8px 22px -10px rgba(16,163,74,0.5)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(22,163,74,0.5)" },
          "100%": { boxShadow: "0 0 0 8px rgba(22,163,74,0)" },
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
