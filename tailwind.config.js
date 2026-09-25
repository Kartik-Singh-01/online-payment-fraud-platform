/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Editorial display + neutral body + monospace for numerics.
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Inter Tight'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          950: "#08090b",
          900: "#0c0e12",
          800: "#13161c",
          700: "#1c2028",
          600: "#272c36",
          500: "#3a414f",
          400: "#5a6273",
          300: "#8b94a6",
          200: "#bcc3d1",
          100: "#e6e9ef",
        },
        signal: {
          safe: "#4ade80",
          warn: "#f59e0b",
          alert: "#ef4444",
          info: "#60a5fa",
        },
        accent: {
          amber: "#f59e0b",
          ember: "#dc2626",
        },
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04)",
        glow: "0 0 0 1px rgba(245,158,11,0.4), 0 0 32px -8px rgba(245,158,11,0.5)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [],
};
