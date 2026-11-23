import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        school: {
          50: "#eff8ff",
          100: "#daf0ff",
          200: "#bde4ff",
          300: "#90d4ff",
          400: "#5cbbfa",
          500: "#369feb",
          600: "#2690d1",
          700: "#1f74ad",
          800: "#205e8b",
          900: "#1f4f74",
          950: "#173350"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
