import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/wirepanel-cad/",
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
});
