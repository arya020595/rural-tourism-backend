const fs = require("fs");
const path = require("path");
const { getBrowser } = require("./puppeteerBrowser");
const { packageItemTypeLabel, packageItemWhen } = require("./packageItemFormat");

/**
 * Sebut Harga / Quotation PDF — see docs/QUOTATION_MODULE.md §7.
 * Uses the shared browser (utils/puppeteerBrowser.js); never launch another.
 */

const EXPLORE_SABAH_BASE64 = (() => {
  try {
    return fs
      .readFileSync(path.join(__dirname, "../assets/explore_sabah-without_bg.png"))
      .toString("base64");
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

/** "2026-11-04" → "04-11-2026" */
function formatDmy(dateOnly) {
  if (!dateOnly) return "-";
  const [year, month, day] = String(dateOnly).slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] || "") + (words[1]?.[0] || "");
}

function paxText(domestik, antarbangsa) {
  const total = domestik + antarbangsa;
  if (domestik && antarbangsa) {
    return `${total} (${domestik} domestik/domestic, ${antarbangsa} antarabangsa/international)`;
  }
  return String(total);
}

function buildHtml(data) {
  const { company } = data;
  const logoSrc = company.logoBase64
    ? company.logoBase64.startsWith("data:")
      ? company.logoBase64
      : `data:image/png;base64,${company.logoBase64}`
    : null;
  const logoHtml = logoSrc
    ? `<img class="logo-img" src="${logoSrc}" alt="Logo" />`
    : `<div class="logo">${escapeHtml(initials(company.name).toUpperCase()) || "-"}</div>`;

  const addressLines = [
    company.address,
    [company.postcode, company.location].filter(Boolean).join(" "),
  ].filter((line) => String(line || "").trim());
  const contactLine = [company.phone, company.email].filter(Boolean).join(" · ");

  const notes = String(data.notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = data.items
    .map((item, index) => {
      const when = packageItemWhen(item);
      const sub = [packageItemTypeLabel(item), item.isOwn ? "" : item.companyName]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td><div class="item-name">${escapeHtml(item.description)}</div>${sub ? `<div class="item-sub">${escapeHtml(sub)}</div>` : ""}</td>
          <td>${escapeHtml(when.main)}${when.sub ? `<div class="item-sub">(${escapeHtml(when.sub)})</div>` : ""}</td>
          <td class="r">${money(item.amount)}</td>
        </tr>`;
    })
    .join("");

  const validity =
    data.validityDays > 0 ? ` (${data.validityDays} hari/day${data.validityDays === 1 ? "" : "s"})` : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12px; padding: 28px 34px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .logo { width: 76px; height: 76px; border-radius: 50%; background: #e7f1ea; color: #04552f; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px; border: 2px solid #04552f; flex: none; }
  .logo-img { height: 76px; max-width: 120px; object-fit: contain; flex: none; }
  .co-name { font-size: 16px; font-weight: bold; color: #04552f; text-transform: uppercase; }
  .co-line { font-size: 11px; color: #444; line-height: 1.45; }
  .doc { text-align: right; flex: none; }
  .doc-title { font-size: 24px; font-weight: bold; color: #04552f; letter-spacing: 0.5px; }
  .doc-sub { font-size: 11px; color: #777; margin-top: 2px; }
  .explore { height: 34px; margin-top: 8px; }
  hr { border: none; border-top: 2px solid #04552f; margin: 16px 0 14px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 16px; }
  .box { border: 1px solid #cfdcd3; border-radius: 8px; padding: 10px 12px; }
  .box h4 { font-size: 10px; color: #04552f; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
  .kv { display: grid; grid-template-columns: 140px 1fr; row-gap: 3px; font-size: 11.5px; }
  .kv span:nth-child(odd) { color: #666; }
  .valid { color: #b3261e; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #04552f; color: #fff; font-size: 10.5px; text-align: left; padding: 8px 10px; }
  thead th em { font-weight: normal; font-style: italic; }
  th.r, td.r { text-align: right; } th.c, td.c { text-align: center; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 11.5px; }
  tbody tr:nth-child(even) td { background: #f8faf9; }
  tr { page-break-inside: avoid; }
  .item-name { font-weight: bold; }
  .item-sub { font-size: 10px; color: #777; margin-top: 2px; }
  .totals { margin-left: auto; width: 290px; margin-top: 10px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 12px; }
  .totals .grand { background: #04552f; color: #fff; font-weight: bold; font-size: 14px; border-radius: 6px; padding: 8px 10px; margin-top: 4px; }
  .notes { margin-top: 20px; page-break-inside: avoid; }
  .notes h4 { font-size: 10.5px; color: #04552f; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
  .notes p { font-size: 10.5px; color: #333; line-height: 1.55; }
  .footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #d2d2d2; text-align: center; font-size: 10px; color: #777; line-height: 1.6; }
  .footer b { color: #b3261e; }
</style></head><body>
  <div class="top">
    <div class="brand">
      ${logoHtml}
      <div>
        <div class="co-name">${escapeHtml(company.name)}</div>
        ${addressLines.map((line) => `<div class="co-line">${escapeHtml(line)}</div>`).join("")}
        ${contactLine ? `<div class="co-line">${escapeHtml(contactLine)}</div>` : ""}
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">QUOTATION</div>
      <div class="doc-sub">SEBUT HARGA</div>
      ${EXPLORE_SABAH_BASE64 ? `<img class="explore" src="data:image/png;base64,${EXPLORE_SABAH_BASE64}" alt="Explore Sabah" />` : ""}
    </div>
  </div>
  <hr>
  <div class="meta">
    <div class="box">
      <h4>Butiran Sebut Harga / Quotation Details</h4>
      <div class="kv">
        <span>No. Sebut Harga / Quotation No.</span><b>${escapeHtml(data.quotationNo)}</b>
        <span>Tarikh / Date</span><b>${escapeHtml(formatDmy(data.quotationDate))}</b>
        <span>Sah Sehingga / Valid Until</span><span class="valid">${escapeHtml(formatDmy(data.validUntil))}${escapeHtml(validity)}</span>
        <span>Disediakan Oleh / Prepared By</span><b>${escapeHtml(data.preparedByName || "-")}</b>
      </div>
    </div>
    <div class="box">
      <h4>Kepada / To</h4>
      <div class="kv">
        <span>Nama / Name</span><b>${escapeHtml(String(data.customerName || "").toUpperCase())}</b>
        <span>No. Telefon / Phone</span><b>${escapeHtml(data.phoneNumber || "-")}</b>
        <span>Emel / Email</span><b>${escapeHtml(data.email || "-")}</b>
        <span>Bilangan Orang / Pax</span><b>${escapeHtml(paxText(data.paxDomestik, data.paxAntarbangsa))}</b>
      </div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th class="c" style="width:28px">#</th>
      <th>Perkara &amp; Keterangan<br><em>Item &amp; Description</em></th>
      <th style="width:170px">Tarikh / Masa Itinerari<br><em>Itinerary Date / Time</em></th>
      <th class="r" style="width:110px">Jumlah (RM)<br><em>Amount</em></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="grand"><span>JUMLAH / TOTAL</span><span>RM ${money(data.totalAmount)}</span></div>
  </div>
  ${notes.length ? `<div class="notes"><h4>Nota &amp; Terma / Notes &amp; Terms</h4>${notes.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>` : ""}
  <div class="footer">
    <b>INI BUKAN RESIT / THIS IS NOT A RECEIPT</b><br>
    Sebut harga ini dijana oleh komputer, tiada tandatangan diperlukan. / This is a computer-generated quotation, no signature required.<br>
    Dijana melalui RuTEC · Explore Sabah
  </div>
</body></html>`;
}

async function generateQuotationPdf(data) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(data), { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });
  } catch (error) {
    console.error("Quotation PDF error:", { message: error?.message, stack: error?.stack });
    throw error;
  } finally {
    await page.close();
  }
}

module.exports = { generateQuotationPdf, buildQuotationHtml: buildHtml };
