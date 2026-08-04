const fs = require("fs");
const path = require("path");
const { getBrowser } = require("./puppeteerBrowser");

const EXPLORE_SABAH_BASE64 = (() => {
  try {
    const imgPath = path.join(
      __dirname,
      "../assets/explore_sabah-without_bg.png",
    );
    return fs.readFileSync(imgPath).toString("base64");
  } catch {
    return null;
  }
})();

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


const MONTHS_MY = [
  "JANUARI",
  "FEBRUARI",
  "MAC",
  "APRIL",
  "MEI",
  "JUN",
  "JULAI",
  "OGOS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DISEMBER",
];

function formatBookingId(id) {
  return `BA_${String(id).padStart(3, "0")}`;
}

function formatHeaderDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_MY[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatActivityDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function buildHtml(data) {
  const {
    id,
    bookingType,
    touristFullName,
    companyName,
    productName,
    packageItems,
    totalPax,
    location,
    activityDate,
    checkInDate,
    checkOutDate,
    totalOfNight,
    status,
    operatorName,
    operatorEmail,
    totalPrice,
    totalDeposit,
    createdAt,
    companyLogoBase64,
  } = data;

  const isAccommodation = bookingType === "accommodation";
  const bookingId = escapeHtml(formatBookingId(id));
  const headerDate = escapeHtml(formatHeaderDate(createdAt));

  const companyLogoSrc = companyLogoBase64
    ? (companyLogoBase64.startsWith("data:") ? companyLogoBase64 : `data:image/png;base64,${companyLogoBase64}`)
    : null;
  const companyLogoHtml = companyLogoSrc
    ? `<div class="logo-company"><img src="${companyLogoSrc}" alt="Company Logo" /></div>`
    : `<div class="logo-company-name">${escapeHtml(companyName) || "-"}</div>`;

  const exploreSabahHtml = EXPLORE_SABAH_BASE64
    ? `<div class="logo-explore"><img src="data:image/png;base64,${EXPLORE_SABAH_BASE64}" alt="Explore Sabah" /></div>`
    : `<div class="logo-explore"><span class="explore-word">Explore</span><span class="sabah-word">SABAH</span><div class="sub">NORTH BORNEO, MALAYSIA</div></div>`;
  const activityDateFormatted = escapeHtml(formatActivityDate(activityDate));
  const checkInFormatted = escapeHtml(formatActivityDate(checkInDate));
  const checkOutFormatted = escapeHtml(formatActivityDate(checkOutDate));
  const totalNightsDisplay = escapeHtml(`${totalOfNight || 0} MALAM/NIGHTS`);
  const totalPaxDisplay = escapeHtml(`${totalPax || 0} ORANG`);
  const totalPriceFormatted = escapeHtml(Number(totalPrice || 0).toFixed(2));
  // The deposit receipt shows the deposit amount under the TOTAL label.
  const totalDepositFormatted = escapeHtml(Number(totalDeposit || 0).toFixed(2));
  const safeTouristFullName = escapeHtml(touristFullName) || "-";
  const safeCompanyName = escapeHtml(companyName) || "-";
  const safeProductName = escapeHtml(productName) || "-";
  const safeLocation = escapeHtml(location) || "-";
  const safeStatus = escapeHtml((status || "").toUpperCase()) || "-";
  // Fall back to the company name when no operator name was provided,
  // matching the e-receipt PDF behaviour.
  const safeOperatorName =
    escapeHtml(String(operatorName || "").trim() || companyName) || "-";
  const safeOperatorEmail = escapeHtml(operatorEmail);

  const isPackage = bookingType === "package";

  // Product label + value differ per booking type. Package bookings list their
  // items instead of a single product name.
  const productLabel = isAccommodation
    ? "PENGINAPAN/<em>ACCOMMODATION</em>"
    : isPackage
      ? "PAKEJ/<em>PACKAGE</em>"
      : "AKTIVITI/<em>ACTIVITY</em>";

  const packageItemsHtml =
    Array.isArray(packageItems) && packageItems.length
      ? packageItems
          .map(
            (item, i) =>
              `<div>${i + 1}. ${escapeHtml(String(item.description || "-"))}</div>`,
          )
          .join("")
      : "-";

  const productValueHtml = isPackage ? packageItemsHtml : safeProductName;

  // Date rows differ per booking type.
  const dateRows = isAccommodation
    ? `
    <div>
      <div class="field-label">TARIKH DAFTAR MASUK/<em>CHECK IN DATE</em></div>
      <div class="field-value">${checkInFormatted}</div>
    </div>
    <div>
      <div class="field-label">TARIKH DAFTAR KELUAR/<em>CHECK OUT DATE</em></div>
      <div class="field-value">${checkOutFormatted}</div>
    </div>
    <div>
      <div class="field-label">JUMLAH MALAM/<em>TOTAL NO. OF NIGHTS</em></div>
      <div class="field-value">${totalNightsDisplay}</div>
    </div>`
    : `
    <div>
      <div class="field-label">TARIKH/<em>${isPackage ? "DATE" : "ACTIVITY DATE"}</em></div>
      <div class="field-value">${activityDateFormatted}</div>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    padding: 48px 52px;
    color: #222;
    font-size: 13px;
  }

  /* â”€â”€ Header â”€â”€ */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 28px;
  }
  .logo-area {
    display: flex;
    align-items: center;
    gap: 0;
  }
  .logo-company {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-right: 16px;
    max-height: 64px;
  }
  .logo-company img {
    max-height: 64px;
    max-width: 100px;
    object-fit: contain;
  }
  .logo-company-name {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-right: 16px;
    font-size: 14px;
    font-weight: bold;
    color: #333;
  }
  .logo-divider {
    width: 1px;
    height: 64px;
    background: #ccc;
    margin: 0 16px;
  }
  .logo-explore img {
    max-height: 64px;
    max-width: 130px;
    object-fit: contain;
  }
  .booking-id-area {
    text-align: right;
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }
  .booking-id-area .id {
    font-weight: bold;
    color: #222;
  }

  /* â”€â”€ Title â”€â”€ */
  .title {
    font-size: 20px;
    font-weight: bold;
    color: #2e7d32;
    margin-bottom: 14px;
  }
  hr {
    border: none;
    border-top: 1.5px solid #ddd;
    margin-bottom: 22px;
  }

  /* â”€â”€ Info grid â”€â”€ */
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 22px;
    column-gap: 30px;
    margin-bottom: 22px;
  }
  .field-label {
    font-size: 9px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 5px;
  }
  .field-label em {
    font-style: italic;
  }
  .field-value {
    font-size: 18px;
    font-weight: bold;
    color: #111;
  }
  .full-width {
    grid-column: 1 / -1;
  }

  /* â”€â”€ Footer: issued-by (left) + total (right) â”€â”€ */
  .receipt-footer {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 24px;
    padding-top: 16px;
    margin-top: 4px;
  }
  .issued-label {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: #4f4f4f;
    margin-bottom: 6px;
  }
  .issued-name {
    font-size: 18px;
    font-weight: bold;
    color: #1e1e1e;
    text-transform: uppercase;
  }
  .issued-email {
    font-size: 13px;
    color: #333;
  }
  .total-block {
    text-align: right;
  }
  .total-label {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #333;
    margin-bottom: 4px;
  }
  .total-value {
    font-size: 26px;
    font-weight: bold;
    color: #111;
    line-height: 1;
  }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      ${exploreSabahHtml}
      <div class="logo-divider"></div>
      ${companyLogoHtml}
    </div>
    <div class="booking-id-area">
      <div class="id">BOOKING ID: ${bookingId}</div>
      <div>${headerDate}</div>
    </div>
  </div>

  <div class="title">BOOKING DEPOSIT RECEIPT</div>
  <hr>

  <!-- Info grid -->
  <div class="grid">
    <div>
      <div class="field-label">DITEMPAH OLEH/<em>BOOKED BY</em></div>
      <div class="field-value">${safeTouristFullName}</div>
    </div>
    <div>
      <div class="field-label">NAMA PERNIAGAAN/<em>BUSINESS NAME</em></div>
      <div class="field-value">${safeCompanyName}</div>
    </div>
    <div>
      <div class="field-label">${productLabel}</div>
      <div class="field-value">${productValueHtml}</div>
    </div>
    <div>
      <div class="field-label">BILANGAN ORANG/<em>TOTAL PAX</em></div>
      <div class="field-value">${totalPaxDisplay}</div>
    </div>
    <div>
      <div class="field-label">LOKASI/<em>LOCATION</em></div>
      <div class="field-value">${safeLocation}</div>
    </div>
    ${dateRows}
    <div class="full-width">
      <div class="field-label">STATUS PEMBAYARAN/<em>PAYMENT STATUS</em></div>
      <div class="field-value">${safeStatus}</div>
    </div>
  </div>

  <hr>

  <!-- Footer: issued-by (left) + total (right), matching the payment receipt -->
  <div class="receipt-footer">
    <div class="issued-block">
      <div class="issued-label">DIKELUARKAN OLEH/ISSUED BY:</div>
      <div class="issued-name">${safeOperatorName}</div>
      <div class="issued-email">${safeOperatorEmail}</div>
    </div>
    <div class="total-block">
      <div class="total-label">JUMLAH/TOTAL(RM)</div>
      <div class="total-value">${totalDepositFormatted}</div>
    </div>
  </div>

</body>
</html>`;
}

async function generateBookingConfirmationPdf(data) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(buildHtml(data), { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return pdfBuffer;
  } catch (error) {
    console.error("Puppeteer PDF generation failed:", {
      message: error?.message || String(error),
      stack: error?.stack,
    });
    throw error;
  } finally {
    await page.close();
  }
}

module.exports = { generateBookingConfirmationPdf };

