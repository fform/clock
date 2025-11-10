import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--color-background))",
        surface: {
          DEFAULT: "hsl(var(--color-surface))",
          elevated: "hsl(var(--color-surface-elevated))",
          subtle: "hsl(var(--color-surface-subtle))",
        },
        border: "hsl(var(--color-border))",
        accent: {
          DEFAULT: "hsl(var(--color-accent))",
          muted: "hsl(var(--color-accent-muted))",
          subtle: "hsl(var(--color-accent-subtle))",
        },
        success: "hsl(var(--color-success))",
        warning: "hsl(var(--color-warning))",
        danger: "hsl(var(--color-danger))",
        on: {
          primary: "hsl(var(--color-on-primary))",
          surface: "hsl(var(--color-on-surface))",
          muted: "hsl(var(--color-on-muted))",
        },
      },
      borderRadius: {
        sm: "calc(var(--radius-base) - 4px)",
        DEFAULT: "var(--radius-base)",
        md: "calc(var(--radius-base) + 4px)",
        xl: "calc(var(--radius-base) + 8px)",
        "2xl": "calc(var(--radius-base) + 12px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...defaultTheme.fontFamily.mono],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(15, 23, 42, 0.06)",
        raised: "0 8px 24px rgba(15, 23, 42, 0.08)",
        outline: "0 0 0 1px rgba(15, 23, 42, 0.08)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-up": "fade-up 200ms ease-out forwards",
        pulse: "pulse 1.5s ease-in-out infinite",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

