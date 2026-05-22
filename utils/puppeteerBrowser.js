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
    _browser = await puppeteer.launch({ headless: "new", args });
  }
  return _browser;
}

module.exports = { getBrowser };
