const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(__dirname, "artifacts", "ui-matrix");
const BASELINE_DIR = path.resolve(__dirname, "artifacts", "baseline");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(BASELINE_DIR);
  const files = fs.readdirSync(SRC_DIR).filter((name) => name.endsWith(".png"));
  for (const file of files) {
    const src = path.join(SRC_DIR, file);
    const dst = path.join(BASELINE_DIR, file);
    fs.copyFileSync(src, dst);
  }
  console.log(`Baseline updated: ${files.length} files -> ${BASELINE_DIR}`);
}

main();

