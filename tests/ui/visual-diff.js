const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch").default;

const CURRENT_DIR = path.resolve(__dirname, "artifacts", "ui-matrix");
const BASELINE_DIR = path.resolve(__dirname, "artifacts", "baseline");
const DIFF_DIR = path.resolve(__dirname, "artifacts", "diff");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function main() {
  ensureDir(DIFF_DIR);
  const files = fs.readdirSync(CURRENT_DIR).filter((name) => name.endsWith(".png"));
  const summary = [];

  for (const file of files) {
    const currentPath = path.join(CURRENT_DIR, file);
    const baselinePath = path.join(BASELINE_DIR, file);
    if (!fs.existsSync(baselinePath)) {
      summary.push({ file, status: "missing-baseline" });
      continue;
    }

    const current = readPng(currentPath);
    const baseline = readPng(baselinePath);
    if (current.width !== baseline.width || current.height !== baseline.height) {
      summary.push({ file, status: "size-mismatch" });
      continue;
    }

    const diff = new PNG({ width: current.width, height: current.height });
    const diffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      current.width,
      current.height,
      { threshold: 0.1 }
    );

    const totalPixels = current.width * current.height;
    const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
    const diffOut = path.join(DIFF_DIR, file);
    PNG.sync.write(diff);
    fs.writeFileSync(diffOut, PNG.sync.write(diff));

    summary.push({
      file,
      status: "ok",
      diffPixels,
      totalPixels,
      diffRatio,
    });
  }

  const summaryPath = path.join(DIFF_DIR, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  const changed = summary.filter((s) => s.status === "ok" && s.diffPixels > 0);
  const missing = summary.filter((s) => s.status !== "ok");

  console.log(`Visual diff finished: ${summary.length} files`);
  console.log(`Changed: ${changed.length}, Issues: ${missing.length}`);
  console.log(`Summary: ${summaryPath}`);
}

main();

