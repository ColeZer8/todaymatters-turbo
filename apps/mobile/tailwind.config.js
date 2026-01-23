module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // In production builds, Tailwind's content scanning can miss class names that are
  // passed via variables (e.g. `className={\`...\${config.bgColor}\`}`), even when the
  // values are defined locally. Safelist the small set we use for icon chips/toggles.
  safelist: [
    "bg-blue-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-pink-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-slate-300",
    "border-blue-600",
    "bg-blue-600",
    "border-slate-300",
    "bg-white",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#2563EB", // Blue from "Paul" and Logo
          secondary: "#3B82F6", // Lighter blue
        },
        text: {
          primary: "#111827", // Dark gray/black
          secondary: "#6B7280", // Gray
          tertiary: "#9CA3AF", // Light gray
        },
        background: {
          light: "#FFFFFF",
          offwhite: "#F9FAFB",
        }
      },
      fontFamily: {
        sans: ["System"], // Default to system font for now
      }
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [],
};
