const express = require("express");
const request = require("supertest");
const { generateToken } = require("../../../middleware/auth");

// ── Service mocks ──────────────────────────────────────────────────────────
const mockList = jest.fn();
const mockGetById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockCancel = jest.fn();
const mockGetPdfData = jest.fn();
const mockBuildBookingDraft = jest.fn();
const mockGetCompanyTerms = jest.fn();
const mockSaveCompanyTerms = jest.fn();

jest.mock("../../../services/quotationService", () => ({
  list: (...args) => mockList(...args),
  getById: (...args) => mockGetById(...args),
  create: (...args) => mockCreate(...args),
  update: (...args) => mockUpdate(...args),
  cancel: (...args) => mockCancel(...args),
  getPdfData: (...args) => mockGetPdfData(...args),
  buildBookingDraft: (...args) => mockBuildBookingDraft(...args),
  getCompanyTerms: (...args) => mockGetCompanyTerms(...args),
  saveCompanyTerms: (...args) => mockSaveCompanyTerms(...args),
}));

const mockGenerateQuotationPdf = jest.fn();
jest.mock("../../../utils/quotationPdfGenerator", () => ({
  generateQuotationPdf: (...args) => mockGenerateQuotationPdf(...args),
}));

const quotationRoutes = require("../../../routes/quotationRoutes");
const { addDays, malaysiaToday } = require("../../../utils/quotationHelpers");

// ── Helpers ────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/quotations", quotationRoutes);
  return app;
};

const makeToken = (permissions = [], role = "operator_admin", overrides = {}) =>
  generateToken({
    id: 100,
    unified_user_id: 100,
    user_type: "operator",
    username: "test_user",
    role,
    permissions,
    company_id: 42,
    ...overrides,
  });

const ADMIN = makeToken([
  "quotation:read", "quotation:create", "quotation:update", "quotation:delete",
  "booking:create", "receipt:create",
]);
const STAFF = makeToken(
  ["quotation:read", "quotation:create", "quotation:update", "booking:create"],
  "operator_staff",
);
const OTHER_COMPANY = makeToken(
  ["quotation:read", "quotation:update", "quotation:delete", "booking:create", "receipt:create"],
  "operator_admin",
  { company_id: 43 },
);
const NO_PERMS = makeToken(["booking:read"]);

const record = (overrides = {}) => ({
  id: 7,
  companyId: 42,
  status: "sent",
  quotationDate: malaysiaToday(),
  validUntil: addDays(malaysiaToday(), 7),
  customerName: "Aminah",
  phoneNumber: "0139876543",
  noOfPaxDomestik: 2,
  noOfPaxAntarbangsa: 0,
  totalAmount: "600.00",
  items: [],
  ...overrides,
});

describe("Quotation routes", () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    mockGetById.mockResolvedValue(record());
  });

  test("401 without a token", async () => {
    const res = await request(app).get("/api/quotations");
    expect(res.status).toBe(401);
  });

  test("403 without quotation:read", async () => {
    const res = await request(app).get("/api/quotations").set("Authorization", `Bearer ${NO_PERMS}`);
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  test("list returns rows, meta and per-status counts", async () => {
    mockList.mockResolvedValue({
      rows: [record()],
      counts: { all: 1, sent: 1, accepted: 0, expired: 0, cancelled: 0 },
      pagination: { total: 1, page: 1, perPage: 10, pages: 1 },
    });
    const res = await request(app).get("/api/quotations?status=sent").set("Authorization", `Bearer ${STAFF}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ id: 7, quotation_no: "QT_0007", status: "sent" });
    expect(res.body.data[0]).not.toHaveProperty("items");
    expect(res.body.counts.sent).toBe(1);
    expect(res.body.meta.total).toBe(1);
  });

  test("show: same company sees it with the right flags", async () => {
    const res = await request(app).get("/api/quotations/7").set("Authorization", `Bearer ${STAFF}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      can_edit: true,
      can_convert: true,
      can_convert_receipt: false, // staff token has no receipt:create
      can_cancel: false, // staff has no quotation:delete (Cancel Quotation)
    });
  });

  test("show: another company gets 403", async () => {
    const res = await request(app).get("/api/quotations/7").set("Authorization", `Bearer ${OTHER_COMPANY}`);
    expect(res.status).toBe(403);
  });

  test("staff cannot cancel (route permission)", async () => {
    const cancel = await request(app).post("/api/quotations/7/cancel").set("Authorization", `Bearer ${STAFF}`);
    expect(cancel.status).toBe(403);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  test("there is no draft: no send or delete endpoints", async () => {
    const send = await request(app).post("/api/quotations/7/send").set("Authorization", `Bearer ${ADMIN}`);
    const del = await request(app).delete("/api/quotations/7").set("Authorization", `Bearer ${ADMIN}`);
    expect(send.status).toBe(404);
    expect(del.status).toBe(404);
  });

  test("update by another company is refused before the service runs", async () => {
    const res = await request(app)
      .put("/api/quotations/7")
      .set("Authorization", `Bearer ${OTHER_COMPANY}`)
      .send({});
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("create returns 201 with the serialized quotation", async () => {
    mockCreate.mockResolvedValue(record());
    const res = await request(app).post("/api/quotations").set("Authorization", `Bearer ${STAFF}`).send({ items: [] });
    expect(res.status).toBe(201);
    expect(res.body.data.quotation_no).toBe("QT_0007");
  });

  test("booking-draft: receipt mode needs receipt:create", async () => {
    const res = await request(app)
      .get("/api/quotations/7/booking-draft?mode=receipt")
      .set("Authorization", `Bearer ${STAFF}`);
    expect(res.status).toBe(403);
    expect(mockBuildBookingDraft).not.toHaveBeenCalled();
  });

  test("booking-draft: bad mode → 400; good mode → draft", async () => {
    const bad = await request(app)
      .get("/api/quotations/7/booking-draft?mode=invoice")
      .set("Authorization", `Bearer ${ADMIN}`);
    expect(bad.status).toBe(400);

    mockBuildBookingDraft.mockReturnValue({ booking_type: "activity", quotation_id: 7 });
    const ok = await request(app)
      .get("/api/quotations/7/booking-draft?mode=receipt")
      .set("Authorization", `Bearer ${ADMIN}`);
    expect(ok.status).toBe(200);
    expect(mockBuildBookingDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), "receipt");
  });

  test("pdf is served inline as QT_0007.pdf", async () => {
    mockGetPdfData.mockResolvedValue({ quotationNo: "QT_0007" });
    mockGenerateQuotationPdf.mockResolvedValue(Buffer.from("%PDF-1.4 test"));
    const res = await request(app).get("/api/quotations/7/pdf").set("Authorization", `Bearer ${STAFF}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe('inline; filename="QT_0007.pdf"');
  });

  test("company terms: read and save (not treated as an id)", async () => {
    mockGetCompanyTerms.mockResolvedValue({ terms: null });
    const get = await request(app).get("/api/quotations/terms").set("Authorization", `Bearer ${STAFF}`);
    expect(get.status).toBe(200);
    expect(get.body.data).toEqual({ terms: null });
    expect(mockGetById).not.toHaveBeenCalled();

    mockSaveCompanyTerms.mockResolvedValue({ terms: "1. Our terms" });
    const put = await request(app)
      .put("/api/quotations/terms")
      .set("Authorization", `Bearer ${STAFF}`)
      .send({ terms: "1. Our terms" });
    expect(put.status).toBe(200);
    expect(mockSaveCompanyTerms).toHaveBeenCalledWith(expect.objectContaining({ company_id: 42 }), "1. Our terms");
  });

  test("company terms: saving needs quotation:create", async () => {
    const res = await request(app)
      .put("/api/quotations/terms")
      .set("Authorization", `Bearer ${NO_PERMS}`)
      .send({ terms: "x" });
    expect(res.status).toBe(403);
    expect(mockSaveCompanyTerms).not.toHaveBeenCalled();
  });

  test("cancelled quotation: no PDF", async () => {
    mockGetById.mockResolvedValue(record({ status: "cancelled" }));
    const res = await request(app).get("/api/quotations/7/pdf").set("Authorization", `Bearer ${STAFF}`);
    expect(res.status).toBe(400);
    expect(mockGenerateQuotationPdf).not.toHaveBeenCalled();
  });

  test("expired quotation: editable, not convertible", async () => {
    mockGetById.mockResolvedValue(record({ status: "sent", validUntil: "2026-01-01" }));
    const res = await request(app).get("/api/quotations/7").set("Authorization", `Bearer ${ADMIN}`);
    expect(res.body.data).toMatchObject({
      status: "expired",
      stored_status: "sent",
      can_edit: true,
      can_convert: false,
      can_convert_receipt: false,
      can_cancel: true,
    });
  });
});
