/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        "muted-foreground": "hsl(var(--muted-foreground))",
      },
    },
  },
  plugins: [],
};
