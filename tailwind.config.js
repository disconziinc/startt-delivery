/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        startt: {
          ink: "#17211b",
          muted: "#627068",
          paper: "#fbfcf8",
          soft: "#f1f5ec",
          green: "#116a4b",
          lime: "#1f8d61",
          yellow: "#f4c95d",
          red: "#d75a3a",
        },
      },
    },
  },
  plugins: [],
};
