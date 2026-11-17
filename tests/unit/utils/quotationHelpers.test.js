const {
  malaysiaToday,
  malaysiaDayStart,
  addDays,
  daysBetween,
  quotationNo,
  parseQuotationNo,
  effectiveStatus,
} = require("../../../utils/quotationHelpers");

describe("quotationHelpers", () => {
  test("malaysiaToday uses UTC+8 whatever the server timezone", () => {
    // 2026-10-29 17:30 UTC is already 30 Oct 01:30 in Malaysia.
    expect(malaysiaToday(Date.UTC(2026, 9, 29, 17, 30))).toBe("2026-10-30");
    expect(malaysiaToday(Date.UTC(2026, 9, 29, 15, 59))).toBe("2026-10-29");
  });

  test("a Malaysia day starts at 16:00 UTC the day before", () => {
    expect(malaysiaDayStart("2026-10-30").toISOString()).toBe("2026-10-29T16:00:00.000Z");
  });

  test("addDays / daysBetween cross month ends", () => {
    expect(addDays("2026-10-29", 7)).toBe("2026-11-05");
    expect(daysBetween("2026-10-29", "2026-11-05")).toBe(7);
    expect(daysBetween("2026-11-05", "2026-11-05")).toBe(0);
  });

  test("quotation number is QT_ + id padded to 4", () => {
    expect(quotationNo(7)).toBe("QT_0007");
    expect(quotationNo(12345)).toBe("QT_12345");
    expect(quotationNo(null)).toBeNull();
  });

  test.each([
    ["QT_0007", 7],
    ["qt7", 7],
    ["QT-12", 12],
    [" QT 0003 ", 3],
    ["Aminah", null],
    ["0007", null],
  ])("parseQuotationNo(%p) → %p", (text, id) => {
    expect(parseQuotationNo(text)).toBe(id);
  });

  test("open quotations past valid-until are expired; closed ones keep their status", () => {
    const today = "2026-10-29";
    expect(effectiveStatus({ status: "sent", validUntil: "2026-10-28" }, today)).toBe("expired");
    expect(effectiveStatus({ status: "sent", validUntil: "2026-10-29" }, today)).toBe("sent");
    expect(effectiveStatus({ status: "accepted", validUntil: "2026-10-01" }, today)).toBe("accepted");
    expect(effectiveStatus({ status: "cancelled", valid_until: "2026-10-01" }, today)).toBe("cancelled");
  });
});
