import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteSingleFile } from "vite-plugin-singlefile";

// Vitest loads this same config, and solid-refresh (the HMR wrapper) cannot
// resolve its virtual module under the test runner — so hot reload is turned
// off there. Dev and build are unaffected.
const isTest = !!process.env.VITEST;

export default defineConfig({
  base: "./",
  plugins: [solid({ hot: !isTest }), viteSingleFile()],
  build: {
    target: "es2022",
  },
});
