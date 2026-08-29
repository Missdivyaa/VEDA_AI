// Copies the pdf.js web worker out of node_modules into public/ so the browser
// can load it same-origin (see lib/pdf.ts -> GlobalWorkerOptions.workerSrc).
// Wired up as the "postinstall" script in package.json, so it runs on every
// `npm install` on every platform. Plain CommonJS on purpose (no build step).
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "node_modules", "pdfjs-dist", "build");
const target = path.join(root, "public", "pdf.worker.min.mjs");

// Prefer the minified worker; fall back to the unminified one if a future
// pdfjs-dist release stops shipping the .min build.
const source = ["pdf.worker.min.mjs", "pdf.worker.mjs"]
  .map((name) => path.join(buildDir, name))
  .find((candidate) => fs.existsSync(candidate));

if (!source) {
  console.error(
    "[copy-pdf-worker] Could not find the pdf.js worker in node_modules/pdfjs-dist/build. " +
      "Is pdfjs-dist installed? Run `npm install` and try again.",
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(
  `[copy-pdf-worker] ${path.relative(root, source)} -> ${path.relative(root, target)}`,
);
