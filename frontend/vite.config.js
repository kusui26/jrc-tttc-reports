// frontend/vite.config.js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    plugins: [vue()],
    build: { outDir: "../server/public/app", emptyOutDir: true },
    server: {
        port: 5173,
        proxy: {
            "/data": "http://localhost:3000" // 開発時は Express へ
        }
    }
});
