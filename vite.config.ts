import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import pkg from "./package.json";

export default defineConfig(({ mode }) => {
  const firefox = mode === "firefox";
  return {
    plugins: [
      webExtension({
        manifest: firefox ? "./manifest.firefox.json" : "./manifest.json",
        watchFilePaths: [firefox ? "manifest.firefox.json" : "manifest.json"],
        browser: firefox ? "firefox" : "chrome",
        transformManifest(manifest) {
          manifest.version = pkg.version;
          return manifest;
        },
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
