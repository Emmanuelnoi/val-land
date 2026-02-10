/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blush: {
          50: "#fff3f6",
          100: "#ffe2eb",
          200: "#ffc7d6",
          300: "#ffa2bc",
          400: "#ff7aa1",
          500: "#f05d88",
          600: "#d94873",
          700: "#b43a5e",
          800: "#8f2f4d",
          900: "#732743"
        },
        rose: {
          50: "#fff0f5",
          100: "#ffdbe7",
          200: "#ffb9cf",
          300: "#ff90b3",
          400: "#ff6e9b",
          500: "#f2447d",
          600: "#d92f68",
          700: "#b02255",
          800: "#8a1c45",
          900: "#6f173a"
        },
        cream: {
          50: "#fff9f5",
          100: "#fff1e8",
          200: "#ffe3d1",
          300: "#ffd4b2"
        },
        ink: {
          500: "#2a1c2b",
          400: "#3a2637",
          300: "#4a3243"
        }
      },
      fontFamily: {
        display: ["'DM Serif Display'", "serif"],
        sans: ["Lexend", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 12px 28px -22px rgba(20, 9, 24, 0.45)",
        lift: "0 24px 50px -26px rgba(20, 9, 24, 0.55)"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(2deg)" }
        },
        fadeScaleOut: {
          "0%": { opacity: 1, transform: "scale(1)" },
          "100%": { opacity: 0, transform: "scale(0.96)" }
        },
        fadeRise: {
          "0%": { opacity: 0, transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: 1, transform: "translateY(0) scale(1)" }
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(14px)" }
        },
        drift: {
          "0%, 100%": { transform: "translateX(0px) translateY(0px)" },
          "50%": { transform: "translateX(-12px) translateY(10px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" }
        }
      },
      animation: {
        wiggle: "wiggle 160ms ease-in-out",
        fadeScaleOut: "fadeScaleOut 200ms ease-in",
        fadeRise: "fadeRise 420ms ease-out",
        floatSlow: "floatSlow 12s ease-in-out infinite",
        drift: "drift 16s ease-in-out infinite",
        shimmer: "shimmer 12s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
