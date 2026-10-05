import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    // relative Pfade: läuft unter https://jgoedde.github.io/crosswords/ wie lokal
    base: "./",
});
