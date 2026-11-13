import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "chrome106",
    rollupOptions: { input: "src/ui/popup.html" },
  },
});
