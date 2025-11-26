/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
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
      }
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [],
};
