/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        atlas: "#0F172A",
        cyber: "#0EA5E9",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(14, 165, 233, 0)" },
          "50%": { boxShadow: "0 0 12px 4px rgba(14, 165, 233, 0.15)" },
        },
        "skeleton-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s ease-out forwards",
        "glow-pulse": "glow-pulse 2s ease-in-out",
        "skeleton-shimmer": "skeleton-shimmer 1.5s infinite linear",
      },
    },
  },
  plugins: [],
};
