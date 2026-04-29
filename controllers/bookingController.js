const bookingsService = require("../services/bookingsService");
const { bookingValidator } = require("../validators/bookingValidator");
const { policy, policyScope } = require("../policies");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const { ForbiddenError } = require("../services/errors/AppError");

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
    return successResponse(res, booking, "Booking created successfully", 201);
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getBookings = async (req, res) => {
  try {
    const scope = policyScope("booking", req.user);
    const result = await bookingsService.getBookings(req.query, scope);
    return paginatedResponse(
      res,
      result.docs,
      "Bookings fetched successfully",
      {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        pages: result.pages,
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
