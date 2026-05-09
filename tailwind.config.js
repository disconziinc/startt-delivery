/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Syne", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      colors: {
        startt: {
          ink: "#141a10",
          muted: "#5a6b52",
          paper: "#f8f9f5",
          soft: "#eef2e8",
          card: "#ffffff",
          border: "#e2e8da",
          green: "#116a4b",
          lime: "#1da86a",
          teal: "#0d8a6e",
          yellow: "#f0c040",
          amber: "#e8a020",
          red: "#c94a2a",
          rose: "#f0ebe8",
          blue: "#2060c0",
        },
      },

      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },

      boxShadow: {
        card: "0 1px 4px 0 rgba(20,26,16,.08), 0 0 0 1px rgba(20,26,16,.06)",

        "card-hover":
          "0 8px 24px -4px rgba(20,26,16,.14), 0 0 0 1px rgba(20,26,16,.06)",

        drawer: "0 24px 80px -12px rgba(20,26,16,.28)",

        input: "0 0 0 3px rgba(17,106,75,.15)",

        toast: "0 8px 32px -4px rgba(20,26,16,.24)",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(.16,1,.3,1)",
      },
    },
  },

  plugins: [],
};