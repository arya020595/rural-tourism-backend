const { getBrowser } = require("./puppeteerBrowser");


function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(data) {
  const { company, ownerName, year, typeLabel, transactions, monthGroups, createdAt, fromDate, toDate, summary, overallTotal } = data;

  const rawLogo = company?.logoBase64 || null;
  const logoSrc = rawLogo
    ? (rawLogo.startsWith("data:") ? rawLogo : `data:image/png;base64,${rawLogo}`)
    : null;
  const companyLogoHtml = logoSrc
    ? `<img class="company-logo" src="${logoSrc}" alt="Company Logo" />`
    : `<div class="company-logo-placeholder">${escapeHtml(company?.name || "")}</div>`;

  const rowHtml = (t) => `
    <tr>
      <td class="nowrap date-cell">
        <div>${escapeHtml(t.receiptDate || t.receiptDateTime || "-")}</div>
        ${t.receiptTime ? `<div class="sub">${escapeHtml(t.receiptTime)}</div>` : ""}
      </td>
      <td class="desc-cell">
        <div class="desc-title">${escapeHtml(t.title || `${t.type} — ${t.name}`)}</div>
        ${(t.details || []).map((line) => `<div class="desc-line">${escapeHtml(line)}</div>`).join("")}
      </td>
      <td class="center">${escapeHtml(String(t.noOfPax))}</td>
      <td class="right amount-cell">${escapeHtml(Number(t.totalPrice || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</td>
    </tr>`;

  // Grouped by receipt month: month heading, its receipts, its subtotal.
  const groups = Array.isArray(monthGroups) && monthGroups.length
    ? monthGroups
    : (transactions.length ? [{ label: "", rows: transactions }] : []);
  const transactionRows = groups
    .map(
      (g) => `
    ${g.label ? `<tr class="month-row"><td colspan="4">${escapeHtml(g.label)}</td></tr>` : ""}
    ${g.rows.map(rowHtml).join("")}
    ${g.label ? `<tr class="month-subtotal">
      <td colspan="2" class="right">Jumlah/<em>Subtotal</em> ${escapeHtml(g.label)}</td>
      <td class="center">${escapeHtml(String(g.totalPax ?? 0))}</td>
      <td class="right">${escapeHtml(Number(g.totalRevenue || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</td>
    </tr>` : ""}`,
    )
    .join("");

  const emptyRow =
    transactions.length === 0
      ? `<tr><td colspan="4" class="empty-row">No transactions found for ${escapeHtml(String(year))}</td></tr>`
      : "";

  const summaryRows = (summary || [])
    .map(
      (s) => `
    <tr>
      <td class="center">${escapeHtml(String(s.no))}</td>
      <td>${escapeHtml(s.name)}</td>
      <td class="center">${escapeHtml(s.type)}</td>
      <td class="center">${escapeHtml(String(s.totalPax))}</td>
      <td class="right">RM ${escapeHtml(s.totalRevenue)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #222;
    font-size: 13px;
  }

  /* ── Header logos ── */
  .header-logos {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    margin-bottom: 20px;
  }
  .company-logo {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }
  .company-logo-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #e8e8e8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #666;
    text-align: center;
    padding: 8px;
  }
  /* ── Company info (centered, below logos) ── */
  .company-info {
    text-align: center;
    margin-bottom: 28px;
  }
  .company-name {
    font-size: 17px;
    font-weight: bold;
    color: #111;
    margin-bottom: 3px;
  }
  .company-est {
    font-size: 12px;
    color: #4a7c59;
  }

  /* ── Section header (dark green bar) ── */
  .section-header {
    background: #1a5c38;
    color: #fff;
    font-size: 13px;
    font-weight: bold;
    padding: 9px 16px;
    margin-bottom: 8px;
  }

  /* ── Business details table ── */
  .details-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #ddd;
    border-top: none;
    margin-bottom: 24px;
  }
  .details-table tr { border-bottom: 1px solid #eee; }
  .details-table tr:last-child { border-bottom: none; }
  .details-table td {
    padding: 10px 16px;
    vertical-align: top;
    line-height: 1.5;
  }
  .details-table td:first-child {
    font-weight: bold;
    width: 40%;
    color: #333;
  }
  .details-table td:last-child {
    color: #555;
    text-align: right;
  }

  /* ── Transaction table ── */
  .transaction-table {
    width: 100%;
    border-collapse: collapse;
  }
  .transaction-table thead tr { background: #1a5c38; }
  .transaction-table thead th {
    color: #fff;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: bold;
    text-align: left;
  }
  .transaction-table thead th.center { text-align: center; }
  .transaction-table thead th.right  { text-align: right; }
  .transaction-table tbody tr { border-bottom: 1px solid #eee; }
  .transaction-table tbody tr:nth-child(even) { background: #f8faf9; }
  .transaction-table tbody td {
    padding: 9px 12px;
    font-size: 12px;
    color: #333;
    vertical-align: top;
  }
  .transaction-table tbody td.center { text-align: center; }
  .transaction-table tbody td.right  { text-align: right; }
  .transaction-table tbody td.name-cell { max-width: 200px; word-wrap: break-word; }
  .transaction-table tbody tr.month-row td {
    background: #e7f1ea;
    color: #1a5c38;
    font-weight: bold;
    font-size: 12px;
    padding: 7px 12px;
    border-top: 1px solid #c9dccf;
  }
  .transaction-table tbody tr.month-subtotal td {
    background: #f3f7f4;
    font-weight: bold;
    color: #1a5c38;
    border-bottom: 2px solid #c9dccf;
  }
  .transaction-table tbody tr.month-subtotal em { font-weight: normal; }
  .transaction-table td.date-cell .sub { font-size: 10px; color: #777; }
  .transaction-table td.desc-cell .desc-title { font-weight: bold; color: #1a1a1a; margin-bottom: 3px; }
  .transaction-table td.desc-cell .desc-line { font-size: 10.5px; color: #555; line-height: 1.45; }
  .transaction-table td.amount-cell { font-weight: bold; white-space: nowrap; }
  .empty-row {
    text-align: center;
    color: #999;
    padding: 28px 0 !important;
    font-style: italic;
  }

  /* ── Account Statement header ── */
  .account-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1a5c38;
    color: #fff;
    font-size: 13px;
    font-weight: bold;
    padding: 9px 16px;
    margin-top: 20px;
    /* Gap above the table's green header row (same as the other sections). */
    margin-bottom: 8px;
  }
  .date-range {
    text-align: right;
    font-size: 12px;
    color: #555;
    font-style: italic;
    margin-bottom: 8px;
    margin-top: 4px;
  }

  .transaction-table td.nowrap { white-space: nowrap; }

  /* ── Document title block ── */
  .doc-title-block {
    text-align: center;
    margin: 14px 0 18px;
    padding: 12px 0;
    border-top: 2px solid #1a5c38;
    border-bottom: 2px solid #1a5c38;
  }
  .doc-title {
    font-size: 18px;
    font-weight: bold;
    color: #1a5c38;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  .doc-meta {
    font-size: 11px;
    color: #444;
    line-height: 1.6;
  }

  /* ── Summary total row ── */
  .summary-total td {
    font-weight: bold;
    background: #1a5c38;
    color: #fff !important;
  }
</style>
</head>
<body>

  <!-- Header: company logo -->
  <div class="header-logos">
    ${companyLogoHtml}
  </div>

  <!-- Company name + established year -->
  <div class="company-info">
    <div class="company-name">${escapeHtml(company?.name || "-")}</div>
  </div>

  <!-- What this document is -->
  <div class="doc-title-block">
    <div class="doc-title">PENYATA AKAUN / ACCOUNT STATEMENT</div>
    <div class="doc-meta">
      Tempoh/<em>Period</em>: <strong>${escapeHtml(fromDate)} – ${escapeHtml(toDate)}</strong>
    </div>
    <div class="doc-meta">Dijana/<em>Generated</em>: ${escapeHtml(createdAt)}</div>
  </div>

  <!-- Business Details -->
  <div class="section-header">Butiran Perniagaan/Business Details</div>
  <table class="details-table">
    <tr>
      <td>Nama Perniagaan/Business Name</td>
      <td>${escapeHtml(company?.name || "-")}</td>
    </tr>
    <tr>
      <td>Nama Pemilik/Owner Name</td>
      <td>${escapeHtml(ownerName || "-")}</td>
    </tr>
    <tr>
      <td>No. Perhubungan/Contact No.</td>
      <td>${escapeHtml(company?.contactNo || "-")}</td>
    </tr>
    <tr>
      <td>Alamat Perniagaan/Business Address</td>
      <td>${escapeHtml(company?.address || "-")}</td>
    </tr>
    <tr>
      <td>Lokasi/Location</td>
      <td>${escapeHtml(company?.location || "-")}</td>
    </tr>
  </table>

  <!-- Transaction list (period/type/date are in the title block above) -->
  <div class="account-header">
    <span>Senarai Transaksi/Transaction List</span>
  </div>

  <!-- Transaction List -->
  <table class="transaction-table">
    <thead>
      <tr>
        <th style="width:96px">Tarikh<br>Date</th>
        <th>Butiran Transaksi<br>Transaction Description</th>
        <th class="center" style="width:60px">Pax</th>
        <th class="right" style="width:120px">Amaun<br>Amount (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${transactionRows}${emptyRow}
    </tbody>
  </table>

  <!-- Summary -->
  <div class="section-header" style="margin-top:48px;page-break-before:auto">Ringkasan Akaun/Summary of Account</div>
  <table class="transaction-table">
    <thead>
      <tr>
        <th class="center" style="width:48px">No.</th>
        <th>Name</th>
        <th class="center">Type</th>
        <th class="center">Total No. of Tourist</th>
        <th class="right">Total Revenue (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
      <tr class="summary-total">
        <td colspan="3" style="text-align:right">Overall Total</td>
        <td class="center">${escapeHtml(String(overallTotal?.totalPax ?? 0))}</td>
        <td class="right">RM ${escapeHtml(String(overallTotal?.totalRevenue ?? "0.00"))}</td>
      </tr>
    </tbody>
  </table>

</body>
</html>`;
}

async function generateTransactionStatementPdf(data) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(data), { waitUntil: "domcontentloaded" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

module.exports = { generateTransactionStatementPdf };
