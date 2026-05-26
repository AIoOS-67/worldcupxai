import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: { 950: "#04140a", 900: "#062716", 700: "#0f5a35", 500: "#1f9d55" },
        trophy: { 500: "#f5b301", 300: "#ffd966" }
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
