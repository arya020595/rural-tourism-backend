let _browser = null;

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
    const launchOptions = { headless: "new", args };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    _browser = await puppeteer.launch(launchOptions);
  }
  return _browser;
}

module.exports = { getBrowser };
