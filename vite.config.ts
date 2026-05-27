import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig(({ mode }) => {
  const firefox = mode === "firefox";
  return {
    plugins: [
      webExtension({
        manifest: firefox ? "./manifest.firefox.json" : "./manifest.json",
        watchFilePaths: [firefox ? "manifest.firefox.json" : "manifest.json"],
        browser: firefox ? "firefox" : "chrome",
      }),
    ],
    build: {
      outDir: firefox ? "dist-firefox" : "dist",
      emptyOutDir: true,
      minify: false,
      sourcemap: true,
    },
  };
});
