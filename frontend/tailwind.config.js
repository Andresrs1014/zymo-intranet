/** @type {import('tailwindcss').Config} */
import tailwindAnimate from "tailwindcss-animate"
import typography from "@tailwindcss/typography"

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Helix Zymo module colors
        helix: {
          accent:      "#ef3340",
          "accent-2":  "#4e5968",
          ai:          "#00a8c8",
          "ai-2":      "#7c5cff",
          done:        "#1f9d6a",
          warning:     "#f5a623",
          danger:      "#ef3340",
          ink:         "#121420",
          muted:       "#5c6374",
          line:        "#d8dde8",
          bg:          "#f4f6fa",
          surface:     "#ffffff",
          "surface-2": "#eef1f6",
          card:        "#fbfcff",
          sidebar:     "#2c333d",
          "bar-track": "#e1e5f4",
        },
        // Brand colors originales — no cambiar
        brand: {
          blue:   "#003087",
          yellow: "#FFD700",
          red:    "#E31E24",
          white:  "#FFFFFF",
        },
        // Variables CSS de shadcn — primary = Zymo red
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "helix-soft":    "6px",
        "helix-regular": "8px",
        "helix-medium":  "10px",
        "helix-large":   "12px",
      },
      boxShadow: {
        "helix-card":    "0 12px 30px rgba(35,38,45,0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
        "helix-soft":    "0 10px 22px rgba(25,29,41,0.06)",
        "helix-task":    "0 8px 18px rgba(35,38,45,0.05)",
        "helix-default": "0 18px 42px rgba(35,38,45,0.12)",
        "helix-btn":     "0 10px 24px rgba(239,51,64,0.18)",
        "helix-nav":     "inset 4px 0 0 #00a8c8, 0 10px 22px rgba(0,0,0,0.14)",
      },
      fontFamily: {
        sans:   ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono:   ['"DM Mono"', 'monospace'],
        barlow: ['Barlow', 'system-ui', 'sans-serif'],
        helix: [
          'Montserrat', 'Helvetica Now Display', 'Arial',
          'ui-sans-serif', 'system-ui', 'sans-serif',
        ],
      },
      keyframes: {
        // Magic UI ShineBorder — borde animado del header de Tareas 2.0
        shine: {
          "0%":  { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          to:    { backgroundPosition: "0% 0%" },
        },
      },
      animation: {
        shine: "shine var(--duration, 14s) infinite linear",
      },
    },
  },
  plugins: [
    typography,
    tailwindAnimate,
  ],
}
