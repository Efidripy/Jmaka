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
  { name: "mobile-320x720", width: 320, height: 720 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
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
    await btn.focus();
    await btn.click({ force: true });
    await wait(450);
    const modal = page.locator('.modal:not([hidden])').first();
    assert((await modal.count()) === 1, `${vp.name}/${item.shot}: modal did not open`);
    const dialog = modal.locator('[role="dialog"]').first();
    assert((await dialog.count()) === 1, `${vp.name}/${item.shot}: missing dialog role`);
    assert((await dialog.getAttribute('aria-modal')) === 'true', `${vp.name}/${item.shot}: missing aria-modal`);
    const activeInside = await page.evaluate(() => {
      const openModal = document.querySelector('.modal:not([hidden]) [role="dialog"]');
      return !!openModal && openModal.contains(document.activeElement);
    });
    assert(activeInside, `${vp.name}/${item.shot}: focus did not enter dialog`);

    await page.keyboard.press('Tab');
    const trapped = await page.evaluate(() => {
      const openModal = document.querySelector('.modal:not([hidden]) [role="dialog"]');
      return !!openModal && openModal.contains(document.activeElement);
    });
    assert(trapped, `${vp.name}/${item.shot}: focus escaped dialog`);

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      modal: (() => {
        const el = document.querySelector('.modal:not([hidden])');
        return el ? el.scrollWidth - el.clientWidth : 0;
      })()
    }));
    assert(overflow.document <= 1, `${vp.name}/${item.shot}: document horizontal overflow ${overflow.document}px`);
    assert(overflow.modal <= 1, `${vp.name}/${item.shot}: modal horizontal overflow ${overflow.modal}px`);

    if (item.shot === 'videoedit') {
      const footerGeometry = await page.evaluate(() => {
        const footer = document.querySelector('#videoEditModal .video-footer');
        const process = document.querySelector('#videoEditSave');
        if (!footer || !process) return null;
        const footerRect = footer.getBoundingClientRect();
        const processRect = process.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          footer: { left: footerRect.left, right: footerRect.right, width: footerRect.width },
          footerStyles: (() => {
            const style = getComputedStyle(footer);
            return { display: style.display, flexDirection: style.flexDirection, alignItems: style.alignItems, overflow: style.overflow, direction: style.direction };
          })(),
          process: { left: processRect.left, right: processRect.right, width: processRect.width },
          rightStyles: (() => {
            const right = process.closest('.video-footer-right');
            const style = right ? getComputedStyle(right) : null;
            const rect = right ? right.getBoundingClientRect() : null;
            return style ? { display: style.display, width: style.width, marginLeft: style.marginLeft, justifyContent: style.justifyContent, alignSelf: style.alignSelf, transform: style.transform, position: style.position, direction: style.direction, rect: rect ? { left: rect.left, right: rect.right, width: rect.width } : null, offsetLeft: right.offsetLeft, parentClass: right.parentElement && right.parentElement.className, parentIsFooter: right.parentElement === footer } : null;
          })(),
          processStyles: (() => {
            const style = getComputedStyle(process);
            return { width: style.width, marginLeft: style.marginLeft, position: style.position };
          })()
        };
      });
      const footerVisible = footerGeometry
        && footerGeometry.footer.left >= -1
        && footerGeometry.footer.right <= footerGeometry.viewportWidth + 1
        && footerGeometry.process.left >= -1
        && footerGeometry.process.right <= footerGeometry.viewportWidth + 1;
      assert(footerVisible, `${vp.name}/videoedit: footer or Process control is clipped: ${JSON.stringify(footerGeometry)}`);
    }
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-${item.shot}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await wait(250);
    assert((await page.locator('.modal:not([hidden])').count()) === 0, `${vp.name}/${item.shot}: Escape did not close modal`);
    assert(await btn.evaluate((el) => document.activeElement === el), `${vp.name}/${item.shot}: focus did not return to trigger`);
  }

  assert(consoleErrors.length === 0, `${vp.name}: console errors: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `${vp.name}: page errors: ${pageErrors.join(' | ')}`);

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
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      if (!message.includes("Executable doesn't exist")) throw err;
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    }
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
