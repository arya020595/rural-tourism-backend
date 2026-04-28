const bookingsService = require("../services/bookingsService");
const { bookingValidator } = require("../validators/bookingValidator");

exports.createBooking = async (req, res) => {
  try {
    const validationResult = bookingValidator.validateCreate(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    const booking = await bookingsService.createBooking(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);

    if (error.details) {
      return res.status(error.statusCode || 400).json({
        error: error.message,
        details: error.details,
      });
    }

    return res.status(error.statusCode || 500).json({
      error: error.message || "Database query error.",
    });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const result = await bookingsService.getBookings(req.query);
    return res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Database query error.",
    });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await bookingsService.getBookingById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Booking fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching booking by id:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Database query error.",
    });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const validationResult = bookingValidator.validateUpdate(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    const booking = await bookingsService.updateBooking(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);

    if (error.details) {
      return res.status(error.statusCode || 400).json({
        error: error.message,
        details: error.details,
      });
    }

    return res.status(error.statusCode || 500).json({
      error: error.message || "Database query error.",
    });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    if (!req.body.status) {
      return res.status(400).json({
        error: "status is required",
      });
    }

    const booking = await bookingsService.updateBookingStatus(
      req.params.id,
      req.body.status,
    );

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Database query error.",
    });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    await bookingsService.deleteBooking(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Database query error.",
    });
  }
};
