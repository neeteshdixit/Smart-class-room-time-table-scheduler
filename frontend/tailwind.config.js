/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Poppins", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 24px 80px rgba(15, 23, 42, 0.45)",
        soft: "0 12px 40px rgba(15, 23, 42, 0.20)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
