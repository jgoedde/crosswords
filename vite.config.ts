import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
    version: string;
};

export default defineConfig({
    plugins: [react()],
    // relative Pfade: läuft unter https://jgoedde.github.io/crosswords/ wie lokal
    base: "./",
    define: {
        __APP_VERSION__: JSON.stringify(version),
        // nur in GitHub Actions gesetzt, lokal leer
        __COMMIT_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? ""),
    },
});
