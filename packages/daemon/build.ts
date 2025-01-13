// Build script (build.ts)
import { build } from "bun";

console.log("Building daemon...");
try {
  await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: false,
    target: "node",
    format: "esm",
    external: [], // Include all dependencies in the bundle
    plugins: [],
  });
} catch (e) {
  console.error("Error building daemon:", e);
}

console.log("Daemon built successfully");
