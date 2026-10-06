import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Segoe UI", "system-ui", "sans-serif"],
        mono: ["Consolas", "ui-monospace", "monospace"],
        heading: ["Segoe UI", "system-ui", "sans-serif"],
      },
      colors: {
        // Tripanza homepage: pale paper, cobalt blue, and lime highlights.
        slate: {
          50: "#f6f8fc", 100: "#f3f6fb", 200: "#e1e6ef",
          300: "#cbd3e2", 400: "#94a0b5", 500: "#687284",
          600: "#485164", 700: "#30384a", 800: "#222a3b",
          900: "#151925", 950: "#0c101c",
        },
        brand: {
          50: "#f0f4ff", 100: "#e4ebff", 200: "#cbd8ff",
          300: "#a3b8fa", 400: "#7a95f0", 500: "#5476e6",
          600: "#3157d5", 700: "#203da6", 800: "#1d3485",
          900: "#1b2d69", 950: "#111a40",
        },
        lime: {
          50: "#f9fce9", 100: "#f3f8db", 200: "#e6efa8",
          300: "#d0e562", 400: "#bdd147", 500: "#9eb72e",
          600: "#71871f", 700: "#53651c", 800: "#414f1c",
          900: "#263407", 950: "#182103",
        },
      },
      animation: {
        "fadeIn": "fadeIn 0.2s ease-out",
        "scaleUp": "scaleUp 0.2s ease-out",
        "slideUp": "slideUp 0.3s ease-out",
        "slideInRight": "slideInRight 0.25s ease-out",
        "spin-slow": "spin-slow 1.5s linear infinite",
        "bubble-in": "bubbleIn 0.3s ease-out",
        "float": "float 3s ease-in-out infinite",
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
        "slide-in-from-bottom": "slideInFromBottom 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleUp: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        bubbleIn: {
          "0%": { transform: "translateY(8px) scale(0.96)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        slideInFromBottom: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
