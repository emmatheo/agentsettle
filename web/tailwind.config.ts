import type { Config } from "tailwindcss";

/**
 * AgentSettle dark theme tokens — unified with the marketing landing.
 *
 * A committed dark duotone: a near-black green-tinted field, dark surfaces with
 * emerald hairline borders, and a single toxic-emerald accent for brand/primary.
 * Emerald also reads as healthy/settled; red is blocked/danger; amber is the
 * "limit reached" edge state. Nothing else gets a color, so accents always mean
 * something.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#060A07",
        raised: "#0B120D",
        canvas: "#060A07",
        arc: { DEFAULT: "#3DFB8F", dim: "#2BE07A" },
        ok: "#22C55E",
        danger: "#FF5C5C",
        warn: "#F5B301",
        fg: "#E6F0E8",
        mute: "#8AA090",
        faint: "#5C7365",
      },
      fontFamily: {
        sans: ['"Geist"', "system-ui", "sans-serif"],
        display: ['"Instrument Serif"', "serif"],
        mono: ['"Geist Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "0.875rem" }] },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.5), 0 18px 40px -24px rgba(61,251,143,0.28)",
        "card-hover": "0 1px 2px rgba(0,0,0,0.5), 0 26px 54px -26px rgba(61,251,143,0.45)",
        glow: "0 8px 26px -8px rgba(61,251,143,0.55)",
        "glow-ok": "0 8px 26px -10px rgba(34,197,94,0.5)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(61,251,143,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(61,251,143,0.05) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(61,251,143,0.5)" },
          "100%": { boxShadow: "0 0 0 8px rgba(61,251,143,0)" },
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
