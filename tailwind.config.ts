import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05070D",
          900: "#0A0E1A",
          800: "#0F1424",
          700: "#151C30",
          600: "#1E2640"
        },
        engineering: {
          50: "#E8EEFC",
          100: "#C5D2F5",
          200: "#9CB1ED",
          300: "#6F8AE0",
          400: "#4A6BD0",
          500: "#2E4FBF",
          600: "#1F3AA0",
          700: "#15297A",
          800: "#0E1D5C",
          900: "#0A2540"
        },
        gold: {
          50: "#FBF6E7",
          100: "#F5E9BF",
          200: "#EFD993",
          300: "#E9C95F",
          400: "#E0B73B",
          500: "#C99A1F",
          600: "#A47B14",
          700: "#7D5C0E",
          800: "#553F08"
        },
        accent: {
          orange: "#FF6B35",
          green: "#00C853",
          amber: "#FFB300",
          red: "#D50000",
          blue: "#2962FF"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        arabic: ["var(--font-cairo)", "Tahoma", "Arial", "sans-serif"],
        display: ["var(--font-cairo)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"]
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "radial-gold":
          "radial-gradient(circle at 50% 0%, rgba(224,183,59,0.18), transparent 60%)",
        "radial-blue":
          "radial-gradient(circle at 80% 20%, rgba(46,79,191,0.30), transparent 55%)",
        "hero-mesh":
          "radial-gradient(at 20% 10%, rgba(46,79,191,0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(224,183,59,0.18) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(255,107,53,0.12) 0px, transparent 50%)"
      },
      boxShadow: {
        "luxury": "0 30px 80px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
        "gold-glow": "0 0 0 1px rgba(224,183,59,0.3), 0 20px 50px -10px rgba(224,183,59,0.25)",
        "edge": "0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 0 rgba(255,255,255,0.04) inset"
      },
      animation: {
        "fade-up": "fadeUp 0.7s ease-out forwards",
        "fade-in": "fadeIn 0.7s ease-out forwards",
        "shimmer": "shimmer 3s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s ease-in-out infinite",
        "scroll-x": "scrollX 40s linear infinite"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" }
        },
        scrollX: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
