const quotationService = require("../services/quotationService");
const { serialize, serializeMany } = require("../serializers/quotationSerializer");
const { policy } = require("../policies");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const { ForbiddenError, BadRequestError } = require("../services/errors/AppError");
const { generateQuotationPdf } = require("../utils/quotationPdfGenerator");

/** Loads the quotation and checks the per-record policy action. */
async function loadAuthorized(req, action, message) {
  const record = await quotationService.getById(req.params.id);
  if (!policy("quotation", req.user, record)[action]()) {
    throw new ForbiddenError(message);
  }
  return record;
}

// GET /api/quotations
exports.list = async (req, res) => {
  try {
    const result = await quotationService.list(req.query, req.user);
    return paginatedResponse(
      res,
      serializeMany(result.rows, req.user),
      "Quotations fetched successfully",
      result.pagination,
      { counts: result.counts },
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/quotations/terms — the company's default notes & terms
exports.getTerms = async (req, res) => {
  try {
    const data = await quotationService.getCompanyTerms(req.user);
    return successResponse(res, data, "Quotation terms fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// PUT /api/quotations/terms — save the company's default notes & terms
exports.saveTerms = async (req, res) => {
  try {
    const data = await quotationService.saveCompanyTerms(req.user, req.body?.terms);
    return successResponse(res, data, "Quotation terms saved");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/quotations/:id
exports.show = async (req, res) => {
  try {
    const record = await loadAuthorized(req, "show", "You do not have permission to view this quotation");
    return successResponse(res, serialize(record, req.user), "Quotation fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// POST /api/quotations
exports.create = async (req, res) => {
  try {
    if (!policy("quotation", req.user).create()) {
      throw new ForbiddenError("You do not have permission to create quotations");
    }
    const record = await quotationService.create(req.body, req.user);
    return successResponse(res, serialize(record, req.user), "Quotation created successfully", 201);
  } catch (error) {
    return errorResponse(res, error);
  }
};

// PUT /api/quotations/:id
exports.update = async (req, res) => {
  try {
    await loadAuthorized(req, "update", "You do not have permission to edit this quotation");
    const record = await quotationService.update(req.params.id, req.body);
    return successResponse(res, serialize(record, req.user), "Quotation updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// POST /api/quotations/:id/cancel
exports.cancel = async (req, res) => {
  try {
    await loadAuthorized(req, "cancel", "You do not have permission to cancel this quotation");
    const record = await quotationService.cancel(req.params.id);
    return successResponse(res, serialize(record, req.user), "Quotation cancelled");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/quotations/:id/pdf
exports.pdf = async (req, res) => {
  try {
    const record = await loadAuthorized(req, "show", "You do not have permission to view this quotation");
    // A cancelled quotation is no longer shared with customers.
    if (record.status === "cancelled") {
      throw new BadRequestError(
        "Sebut harga ini telah dibatalkan / This quotation was cancelled — no PDF.",
      );
    }
    const data = await quotationService.getPdfData(req.params.id);
    const pdfBuffer = await generateQuotationPdf(data);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.quotationNo}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("[quotation pdf] error:", error);
    return errorResponse(res, error);
  }
};

// GET /api/quotations/:id/booking-draft?mode=booking|receipt
exports.bookingDraft = async (req, res) => {
  try {
    const mode = String(req.query.mode || "booking").toLowerCase();
    if (!["booking", "receipt"].includes(mode)) {
      throw new BadRequestError("mode must be 'booking' or 'receipt'");
    }
    const record = await quotationService.getById(req.params.id);
    if (!policy("quotation", req.user, record).convert(mode)) {
      throw new ForbiddenError(
        mode === "receipt"
          ? "You do not have permission to convert this quotation to a receipt"
          : "You do not have permission to convert this quotation to a booking",
      );
    }
    const draft = quotationService.buildBookingDraft(record, mode);
    return successResponse(res, draft, "Booking draft built from quotation");
  } catch (error) {
    return errorResponse(res, error);
  }
};
