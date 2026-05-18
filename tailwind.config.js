/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      colors: {
        startt: {
          ink: "#14110f",
          muted: "#6f675f",
          paper: "#faf8f5",
          soft: "#f3eee8",
          card: "#ffffff",
          border: "#e8e1d8",
          green: "#f26a1b",
          lime: "#f59e0b",
          teal: "#c45113",
          yellow: "#f6b45a",
          amber: "#d85a16",
          red: "#c93422",
          rose: "#fff2ea",
          blue: "#2563eb",
        },
      },

      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },

      boxShadow: {
        card: "0 1px 4px 0 rgba(20,17,15,.08), 0 0 0 1px rgba(20,17,15,.06)",

        "card-hover":
          "0 18px 40px -18px rgba(20,17,15,.28), 0 0 0 1px rgba(20,17,15,.06)",

        drawer: "0 28px 90px -18px rgba(20,17,15,.34)",

        input: "0 0 0 3px rgba(242,106,27,.16)",

        toast: "0 8px 32px -4px rgba(20,17,15,.24)",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(.16,1,.3,1)",
      },
    },
  },

  plugins: [],
};
