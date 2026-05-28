const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = path.resolve(__dirname, "artifacts", "ui-matrix");
const BASE_URL = "http://127.0.0.1:5189";

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error(`Server did not start in ${timeoutMs}ms`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function captureForViewport(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await wait(600);

  await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-main.png`), fullPage: true });

  const modalButtons = [
    { id: "#cropToolBtn", shot: "crop" },
    { id: "#splitToolBtn", shot: "split" },
    { id: "#split3ToolBtn", shot: "split3" },
    { id: "#oknoFixToolBtn", shot: "oknofix" },
    { id: "#oknoScaleToolBtn", shot: "oknoscale" },
    { id: "#imageEditToolBtn", shot: "imageedit" },
    { id: "#videoEditToolBtn", shot: "videoedit" },
  ];

  for (const item of modalButtons) {
    await page.keyboard.press("Escape");
    await wait(150);
    const btn = page.locator(item.id).first();
    if ((await btn.count()) === 0) continue;
    if (!(await btn.isEnabled())) continue;
    await btn.click({ force: true });
    await wait(450);
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-${item.shot}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await wait(250);
  }

  await ctx.close();
}

async function main() {
  ensureDir(OUT_DIR);
  let app = null;

  try {
    try {
      await waitForServer(`${BASE_URL}/api/version`, 2500);
    } catch {
      app = spawn(
        "dotnet",
        ["run", "--project", "src/Jmaka.Api", "--launch-profile", "http"],
        {
          cwd: path.resolve(__dirname, "..", ".."),
          stdio: "inherit",
          shell: true,
        }
      );
      await waitForServer(`${BASE_URL}/api/version`);
    }
    const browser = await chromium.launch({ headless: true });
    for (const vp of viewports) {
      await captureForViewport(browser, vp);
    }
    await browser.close();
    console.log(`UI matrix done: ${OUT_DIR}`);
  } finally {
    if (app && !app.killed) {
      app.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
