import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/basic2dcad/",
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
});
