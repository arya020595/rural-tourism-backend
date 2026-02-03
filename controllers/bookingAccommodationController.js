const AccommodationBooking = require("../models/bookingAccommodationModel");
const { Op } = require("sequelize");

// Create a new accommodation booking
exports.createAccommodationBooking = async (req, res) => {
  try {
    const {
      tourist_user_id,
      accommodation_id,
      check_in,
      check_out,
      total_no_of_nights,
      total_price,
      no_of_pax,
      contact_name,
      contact_email,
      contact_phone,
      nationality,
      status,
    } = req.body;

    // Basic validation
    if (
      !tourist_user_id ||
      !accommodation_id ||
      !total_price ||
      !check_in ||
      !check_out ||
      !total_no_of_nights
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const newBooking = await AccommodationBooking.create({
      tourist_user_id,
      accommodation_id,
      check_in,
      check_out,
      total_no_of_nights,
      total_price,
      status: status || "pending",
      no_of_pax,
      contact_name,
      contact_email,
      contact_phone,
      nationality,
    });

    return res.status(201).json({
      success: true,
      message: "Accommodation booking successfully created",
      data: newBooking,
    });
  } catch (error) {
    console.error("Error creating accommodation booking:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while creating booking" });
  }
};

// Get an accommodation booking by ID
exports.getAccommodationBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await AccommodationBooking.findByPk(id);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error("Error fetching accommodation booking by ID:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while fetching booking" });
  }
};

// Get all accommodation bookings for a specific tourist user
exports.getAccommodationBookingsByUser = async (req, res) => {
  try {
    const { tourist_user_id } = req.params;
    const bookings = await AccommodationBooking.findAll({
      where: { tourist_user_id },
    });

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No bookings found for this user" });
    }

    return res.json({ success: true, data: bookings });
  } catch (error) {
    console.error("Error fetching accommodation bookings for user:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching bookings",
    });
  }
};

// Get all booked dates for a specific accommodation
exports.getBookedDatesByAccommodation = async (req, res) => {
  try {
    const { accommodation_id } = req.params;

    const bookings = await AccommodationBooking.findAll({
      where: {
        accommodation_id,
        status: {
          [Op.in]: ["booked", "paid", "pending"],
        },
      },
      attributes: ["check_in", "check_out"],
      raw: true,
    });

    // Expand date ranges to individual dates
    const bookedDates = new Set();

    bookings.forEach((booking) => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);

      // Generate all dates between check_in and check_out (inclusive)
      for (
        let d = new Date(checkIn);
        d <= checkOut;
        d = new Date(d.getTime() + 86400000)
      ) {
        bookedDates.add(d.toISOString().split("T")[0]);
      }
    });

    return res.json({
      success: true,
      data: Array.from(bookedDates),
    });
  } catch (error) {
    console.error("Error fetching booked dates:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching booked dates",
    });
  }
};
