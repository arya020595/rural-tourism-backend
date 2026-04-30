const puppeteer = require("puppeteer");

const MONTHS_MY = [
  "JAN",
  "FEB",
  "MAC",
  "APR",
  "MEI",
  "JUN",
  "JUL",
  "OGO",
  "SEP",
  "OKT",
  "NOV",
  "DIS",
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
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes}${ampm}`;
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
    touristFullName,
    companyName,
    productName,
    totalPax,
    location,
    activityDate,
    status,
    operatorName,
    operatorEmail,
    totalPrice,
    createdAt,
  } = data;

  const bookingId = formatBookingId(id);
  const headerDate = formatHeaderDate(createdAt);
  const activityDateFormatted = formatActivityDate(activityDate);
  const totalPaxDisplay = `${totalPax || 0} ORANG`;
  const totalPriceFormatted = Number(totalPrice || 0).toFixed(2);

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

  /* ── Header ── */
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
  .logo-panda {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-right: 16px;
  }
  .logo-panda .icon {
    font-size: 40px;
    line-height: 1;
  }
  .logo-panda .name {
    font-size: 11px;
    font-weight: bold;
    color: #333;
    margin-top: 2px;
  }
  .logo-panda .est {
    font-size: 9px;
    color: #888;
  }
  .logo-divider {
    width: 1px;
    height: 64px;
    background: #ccc;
    margin: 0 16px;
  }
  .logo-explore .explore-word {
    font-size: 13px;
    font-weight: bold;
    color: #1565c0;
    font-style: italic;
  }
  .logo-explore .sabah-word {
    font-size: 22px;
    font-weight: 900;
    color: #1565c0;
    letter-spacing: 1px;
    display: block;
    line-height: 1;
  }
  .logo-explore .sub {
    font-size: 9px;
    color: #777;
    margin-top: 2px;
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

  /* ── Title ── */
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

  /* ── Info grid ── */
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

  /* ── Issued by ── */
  .issued-by {
    text-align: center;
    padding: 12px 0 16px;
    font-size: 11px;
    color: #666;
    line-height: 1.8;
  }
  .issued-by .label {
    font-size: 11px;
    color: #666;
  }
  .issued-by .name {
    font-size: 14px;
    font-weight: bold;
    color: #111;
  }
  .issued-by .email {
    font-size: 12px;
    color: #555;
  }

  /* ── Total ── */
  .total-section {
    text-align: right;
    padding-top: 16px;
  }
  .total-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
  }
  .total-value {
    font-size: 26px;
    font-weight: bold;
    color: #111;
  }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <div class="logo-panda">
        <div class="icon">🐼</div>
        <div class="name">Panda Co.</div>
        <div class="est">Est. 2025</div>
      </div>
      <div class="logo-divider"></div>
      <div class="logo-explore">
        <span class="explore-word">Explore</span>
        <span class="sabah-word">SABAH</span>
        <div class="sub">NORTH BORNEO, MALAYSIA</div>
      </div>
    </div>
    <div class="booking-id-area">
      <div class="id">BOOKING ID: ${bookingId}</div>
      <div>${headerDate}</div>
    </div>
  </div>

  <div class="title">BOOKING CONFIRMATION</div>
  <hr>

  <!-- Info grid -->
  <div class="grid">
    <div>
      <div class="field-label">DITEMPAH OLEH/<em>BOOKED BY</em></div>
      <div class="field-value">${touristFullName || "-"}</div>
    </div>
    <div>
      <div class="field-label">NAMA PERNIAGAAN/<em>BUSINESS NAME</em></div>
      <div class="field-value">${companyName || "-"}</div>
    </div>
    <div>
      <div class="field-label">AKTIVITI/<em>ACTIVITY</em></div>
      <div class="field-value">${productName || "-"}</div>
    </div>
    <div>
      <div class="field-label">BILANGAN ORANG/<em>TOTAL PAX</em></div>
      <div class="field-value">${totalPaxDisplay}</div>
    </div>
    <div>
      <div class="field-label">LOKASI/<em>LOCATION</em></div>
      <div class="field-value">${location || "-"}</div>
    </div>
    <div>
      <div class="field-label">TARIKH/<em>BOOKED DATE</em></div>
      <div class="field-value">${activityDateFormatted}</div>
    </div>
    <div class="full-width">
      <div class="field-label">STATUS PEMBAYARAN/<em>PAYMENT STATUS</em></div>
      <div class="field-value">${(status || "").toUpperCase()}</div>
    </div>
  </div>

  <hr>

  <!-- Issued by -->
  <div class="issued-by">
    <div class="label">DIKELUARKAN OLEH/ISSUED BY:</div>
    <div class="name">${operatorName || "-"}</div>
    <div class="email">${operatorEmail || ""}</div>
  </div>

  <hr>

  <!-- Total -->
  <div class="total-section">
    <div class="total-label">JUMLAH/TOTAL(RM)</div>
    <div class="total-value">${totalPriceFormatted}</div>
  </div>

</body>
</html>`;
}

async function generateBookingConfirmationPdf(data) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(data), { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateBookingConfirmationPdf };
