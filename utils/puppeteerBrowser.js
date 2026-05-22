const path = require("path");
const fs = require("fs");

let _browser = null;

function resolveExecutablePath() {
  // Honour explicit override (set in Docker/staging via env var)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // On Windows, puppeteer v23 bundles both chrome.exe and chrome-headless-shell.exe.
  // Regular chrome.exe hangs on page.pdf(); chrome-headless-shell is the correct binary
  // for headless PDF generation.
  if (process.platform === "win32") {
    const cacheRoot = path.join(
      process.env.USERPROFILE || process.env.HOME || "",
      ".cache",
      "puppeteer",
      "chrome-headless-shell"
    );
    if (fs.existsSync(cacheRoot)) {
      const versions = fs.readdirSync(cacheRoot).filter((d) =>
        d.startsWith("win64-")
      );
      for (const ver of versions.sort().reverse()) {
        const exe = path.join(
          cacheRoot,
          ver,
          "chrome-headless-shell-win64",
          "chrome-headless-shell.exe"
        );
        if (fs.existsSync(exe)) return exe;
      }
    }
  }

  return null; // let puppeteer use its default
}

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    const puppeteer = require("puppeteer");
    const isLinux = process.platform === "linux";
    const args = isLinux
      ? [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
        ]
      : [];

    const launchOptions = { headless: true, args };
    const executablePath = resolveExecutablePath();
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    _browser = await puppeteer.launch(launchOptions);
  }
  return _browser;
}

module.exports = { getBrowser };
