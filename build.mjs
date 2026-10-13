// Bundle src/ into one file for HACS: dist/bus-board-card.js
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const watch = process.argv.includes("--watch");

const opts = {
  entryPoints: ["src/bus-board-card.js"],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  outfile: "dist/bus-board-card.js",
  minify: !watch,
  sourcemap: false,
  legalComments: "inline",
  define: { __VERSION__: JSON.stringify(pkg.version) },
  banner: { js: `/*! bus-board-card ${pkg.version} — MIT — https://github.com/andersgar/bus-board-card */` },
};

if (watch) {
  const { context } = await import("esbuild");
  const ctx = await context(opts);
  await ctx.watch();
  console.log("watching src/ …");
} else {
  await build(opts);
  console.log(`built dist/bus-board-card.js (${pkg.version})`);
}
