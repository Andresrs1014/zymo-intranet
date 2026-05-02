/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:   "#003087",
          yellow: "#FFD700",
          red:    "#E31E24",
          white:  "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
