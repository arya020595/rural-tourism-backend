const bookingsService = require("../services/bookingsService");
const { bookingValidator } = require("../validators/bookingValidator");
const { policy, policyScope } = require("../policies");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const { ForbiddenError } = require("../services/errors/AppError");
const {
  generateBookingConfirmationPdf,
} = require("../utils/bookingPdfGenerator");
const {
  generateAccommodationReceiptPdf,
} = require("../utils/receiptAccommodationPdfGenerator");
const {
  generateActivityReceiptPdf,
} = require("../utils/receiptActivityPdfGenerator");
const {
  generatePackageReceiptPdf,
} = require("../utils/receiptPackagePdfGenerator");

exports.createBooking = async (req, res) => {
  try {
    const validationResult = bookingValidator.validateCreate(req.body);
    if (!validationResult.isValid) {
      return errorResponse(
        res,
        validationResult.message || "Validation failed",
        400,
        validationResult.errors,
      );
    }

    const booking = await bookingsService.createBooking(req.body, req.user);

    const clientKey = req.body.idempotency_key;
    const isIdempotent = clientKey && booking.idempotency_key === clientKey;
    const statusCode = isIdempotent ? 200 : 201;
    const message = isIdempotent
      ? "Booking already exists (idempotent)"
      : "Booking created successfully";

    return successResponse(res, booking, message, statusCode);
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getBookings = async (req, res) => {
  try {
    const result = await bookingsService.getBookings(req.query, req.user);
    return paginatedResponse(
      res,
      result.data,
      "Bookings fetched successfully",
      {
        total: result.meta.total,
        page: result.meta.page,
        perPage: result.meta.per_page,
        pages: result.meta.total_pages,
      },
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getPackageBookings = async (req, res) => {
  try {
    const result = await bookingsService.getPackageBookings(
      req.query,
      req.user,
    );
    return paginatedResponse(
      res,
      result.data,
      "Package bookings fetched successfully",
      {
        total: result.meta.total,
        page: result.meta.page,
        perPage: result.meta.per_page,
        pages: result.meta.total_pages,
      },
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, booking).show()) {
      throw new ForbiddenError(
        "You do not have permission to view this booking",
      );
    }
    return successResponse(res, booking, "Booking fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const validationResult = bookingValidator.validateUpdate(req.body);
    if (!validationResult.isValid) {
      return errorResponse(
        res,
        validationResult.message || "Validation failed",
        400,
        validationResult.errors,
      );
    }

    const existing = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, existing).update()) {
      throw new ForbiddenError(
        "You do not have permission to update this booking",
      );
    }

    const booking = await bookingsService.updateBooking(
      req.params.id,
      req.body,
      req.user,
    );
    return successResponse(res, booking, "Booking updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    if (!req.body.status) {
      return errorResponse(res, "status is required", 400);
    }

    const existing = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, existing).update()) {
      throw new ForbiddenError(
        "You do not have permission to update this booking",
      );
    }

    const booking = await bookingsService.updateBookingStatus(
      req.params.id,
      req.body.status,
    );
    return successResponse(res, booking, "Booking status updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const existing = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, existing).destroy()) {
      throw new ForbiddenError(
        "You do not have permission to delete this booking",
      );
    }
    await bookingsService.deleteBooking(req.params.id);
    return successResponse(res, null, "Booking deleted successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// PATCH /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  try {
    const existing = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, existing).update()) {
      throw new ForbiddenError(
        "You do not have permission to cancel this booking",
      );
    }

    const booking = await bookingsService.updateBookingStatus(
      req.params.id,
      "cancelled",
    );
    return successResponse(res, booking, "Booking cancelled successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// PATCH /api/bookings/:id/payment
exports.markBookingAsPaid = async (req, res) => {
  try {
    const existing = await bookingsService.getBookingById(req.params.id);
    if (!policy("booking", req.user, existing).update()) {
      throw new ForbiddenError(
        "You do not have permission to mark this booking as paid",
      );
    }

    const booking = await bookingsService.updateBookingStatus(
      req.params.id,
      "paid",
    );
    return successResponse(res, booking, "Booking marked as paid successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.generateBookingPdf = async (req, res) => {
  console.log("Booking PDF handler invoked", {
    bookingId: req.params.id,
    userId: req.user?.id,
  });
  try {
    const data = await bookingsService.getBookingPdfData(req.params.id);
    if (!policy("booking", req.user, data).show()) {
      throw new ForbiddenError(
        "You do not have permission to view this booking",
      );
    }

    const pdfBuffer = await generateBookingConfirmationPdf(data);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="booking-${data.id}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("[generateBookingPdf] error:", error);
    return errorResponse(res, error);
  }
};

exports.generateReceiptPdf = async (req, res) => {
  try {
    const data = await bookingsService.getReceiptPdfData(req.params.id);

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const pdfUrl = `${protocol}://${host}/api/bookings/${data.id}/receipt-pdf`;

    let pdfBuffer;
    let filename;

    if (data.bookingType === "accommodation") {
      pdfBuffer = await generateAccommodationReceiptPdf(data, pdfUrl);
      filename = `receipt-accommodation-${data.id}.pdf`;
    } else if (data.bookingType === "package") {
      pdfBuffer = await generatePackageReceiptPdf(data, pdfUrl);
      filename = `receipt-package-${data.id}.pdf`;
    } else {
      pdfBuffer = await generateActivityReceiptPdf(data, pdfUrl);
      filename = `receipt-activity-${data.id}.pdf`;
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("[generateReceiptPdf] error:", error);
    return errorResponse(res, error);
  }
};
