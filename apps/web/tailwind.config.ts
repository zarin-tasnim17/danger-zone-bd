import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F172A",
          primary: "#2563EB",
          accent: "#DC2626",
        },
        danger: {
          critical: "#DC2626",
          "critical-bg": "#FEF2F2",
          "critical-border": "#FCA5A5",
          "critical-dark": "#991B1B",
          warning: "#EA580C",
          "warning-bg": "#FFF7ED",
          "warning-border": "#FDBA74",
          caution: "#CA8A04",
          "caution-bg": "#FEFCE8",
          "caution-border": "#FDE047",
          safe: "#16A34A",
          "safe-bg": "#F0FDF4",
          "safe-border": "#86EFAC",
        },
        surface: {
          base: "#FFFFFF",
          subtle: "#F8FAFC",
          muted: "#F1F5F9",
          border: "#E2E8F0",
          dark: "#0F172A",
          panel: "#1E293B",
        },
        content: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#64748B",
          inverse: "#F8FAFC",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans Bengali",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        bengali: ["Noto Sans Bengali", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)",
        overlay: "0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
