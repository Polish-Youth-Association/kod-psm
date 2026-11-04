import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#C8102E",
          "red-dark": "#A00D24",
          "red-light": "#FEF2F4",
          rose: "#F43F5E",
          ink: "#0B0F19",
          dark: "#111827",
          gray: "#6B7280",
          border: "#E5E7EB"
        }
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        glow: "0 10px 30px -10px rgba(200, 16, 46, 0.55)",
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px -12px rgba(16, 24, 40, 0.12)",
        lift: "0 2px 4px rgba(16, 24, 40, 0.04), 0 24px 48px -16px rgba(200, 16, 46, 0.28)"
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(40px, -30px) scale(1.08)" },
          "66%": { transform: "translate(-30px, 20px) scale(0.95)" }
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "toast-in": "toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        blob: "blob 18s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
