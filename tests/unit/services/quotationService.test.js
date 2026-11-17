const quotationService = require("../../../services/quotationService");
const { addDays, malaysiaToday } = require("../../../utils/quotationHelpers");

const future = addDays(malaysiaToday(), 5);

const baseRecord = (overrides = {}) => ({
  id: 7,
  companyId: 42,
  status: "sent",
  validUntil: future,
  customerName: "Aminah binti Ali",
  phoneNumber: "0139876543",
  email: "aminah@example.com",
  citizenship: "both",
  noOfPaxDomestik: 4,
  noOfPaxAntarbangsa: 2,
  totalAmount: "870.00",
  preparedByName: "Puan Rosnah",
  items: [],
  ...overrides,
});

const room = {
  sortOrder: 0,
  productType: "accommodation",
  companyId: 42,
  companyName: "KLK Lodge",
  productId: 286,
  description: "Family Room",
  amount: "600.00",
  activityDate: null,
  checkInDate: "2026-11-14",
  checkOutDate: "2026-11-16",
};
const hike = {
  sortOrder: 1,
  productType: "activity",
  companyId: 43,
  companyName: "Tukad Sandangau",
  productId: 36,
  description: "Hiking",
  amount: "270.00",
  activityDate: new Date("2026-11-16T07:00:00Z"),
  checkInDate: null,
  checkOutDate: null,
};

describe("QuotationService.buildBookingDraft", () => {
  test("one accommodation item → accommodation booking with nights", () => {
    const draft = quotationService.buildBookingDraft(baseRecord({ items: [room] }), "booking");
    expect(draft).toMatchObject({
      quotation_id: 7,
      quotation_no: "QT_0007",
      booking_type: "accommodation",
      product_id: 286,
      product_name: "Family Room",
      check_in_date: "2026-11-14",
      check_out_date: "2026-11-16",
      total_of_night: 2,
      total_price: 600,
      tourist_full_name: "Aminah binti Ali",
      no_of_pax_domestik: 4,
      no_of_pax_antarbangsa: 2,
      operator_name: "Puan Rosnah",
      status: "booked",
    });
  });

  test("one activity item in receipt mode → paid activity booking", () => {
    const draft = quotationService.buildBookingDraft(
      baseRecord({ companyId: 43, items: [{ ...hike, companyId: 43 }] }),
      "receipt",
    );
    expect(draft).toMatchObject({
      booking_type: "activity",
      product_id: 36,
      activity_date: hike.activityDate,
      total_price: 270,
      status: "paid",
      mode: "receipt",
    });
  });

  test("two or more items → package with items like booking_package_companies", () => {
    const draft = quotationService.buildBookingDraft(baseRecord({ items: [hike, room] }));
    expect(draft.booking_type).toBe("package");
    expect(draft.total_price).toBe(870);
    // Ordered by sort_order, not array order.
    expect(draft.package_companies.map((item) => item.description)).toEqual(["Family Room", "Hiking"]);
    expect(draft.package_companies[1]).toMatchObject({
      referrer_id: 42,
      referee_id: 43,
      referee_company: "Tukad Sandangau",
      per_price: 270,
      product_type: "activity",
    });
  });

  test.each([
    [{ status: "accepted" }, /already converted/],
    [{ status: "cancelled" }, /already converted/],
    [{ status: "sent", validUntil: "2026-01-01" }, /expired/],
  ])("refuses %p", (overrides, message) => {
    expect(() =>
      quotationService.buildBookingDraft(baseRecord({ items: [room], ...overrides })),
    ).toThrow(message);
  });
});

describe("QuotationService.normalizeInput (checks before any DB lookup)", () => {
  const body = (overrides = {}) => ({
    customer_name: "Aminah",
    phone_number: "0139876543",
    citizenship: "domestic",
    no_of_pax_domestik: 2,
    items: [{ product_type: "accommodation", company_id: 43, product_id: 1, amount: 100, check_in_date: "2026-11-14", check_out_date: "2026-11-15" }],
    ...overrides,
  });

  test.each([
    [{ customer_name: "" }, /customer_name is required/],
    [{ phone_number: "123" }, /valid telephone number/],
    [{ email: "not-an-email" }, /valid email/],
    [{ citizenship: "mars" }, /citizenship must be one of/],
    [{ no_of_pax_domestik: 0 }, /at least 1/],
    [{ no_of_pax_domestik: "abc", no_of_pax_antarbangsa: 1 }, /whole numbers/],
    [{ no_of_pax_domestik: 2.5 }, /whole numbers/],
    [{ quotation_date: "2026-02-30" }, /quotation_date is not a valid date/],
    [{ valid_until: "2026-11-31" }, /valid_until is not a valid date/],
    [{ notes: "n".repeat(5001) }, /at most 5000 characters/],
    [{ items: [{ product_type: "accommodation", company_id: 42, product_id: 1, amount: 10, check_in_date: "2026-11-30", check_out_date: "2026-11-31" }] }, /check_out_date is not a valid date/],
    [{ quotation_date: "2026-10-10", valid_until: "2026-10-09" }, /on or after the quotation date/],
    [{ items: [] }, /at least one item/],
    [{ items: [{ product_type: "spa", company_id: 42, product_id: 1, amount: 10 }] }, /product_type/],
    [{ items: [{ product_type: "activity", company_id: 42, product_id: 1, amount: 0, activity_date: "2026-11-14" }] }, /price must be greater than 0/],
    [{ items: [{ product_type: "activity", company_id: 42, product_id: 1, amount: 10 }] }, /activity date is required/],
  ])("rejects %p", async (overrides, message) => {
    await expect(quotationService.normalizeInput(body(overrides), 42)).rejects.toThrow(message);
  });

  test("needs at least one of the company's own products", async () => {
    await expect(quotationService.normalizeInput(body(), 42)).rejects.toThrow(
      /your company's product/,
    );
  });
});
