const ActivityBooking = require("../models/bookingActivityModel");
const OperatorActivities = require("../models/operatorActivitiesModel");

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const {
      tourist_user_id,
      activity_id,
      operator_activity_id,
      no_of_pax,
      date,
      contact_name,
      contact_phone,
      nationality,
      total_price,
    } = req.body;

    // Basic validation
    if (!tourist_user_id || !activity_id || !total_price) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Fetch operator_activity_id if not provided
    let opActivityId = operator_activity_id;
    if (!opActivityId) {
      const operatorActivity = await OperatorActivities.findOne({
        where: { activity_id },
      });

      if (!operatorActivity) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Operator not found for this activity",
          });
      }
      opActivityId = operatorActivity.id;
    }

    // Create booking
    const newBooking = await ActivityBooking.create({
      tourist_user_id,
      activity_id,
      operator_activity_id: opActivityId,
      no_of_pax,
      date,
      contact_name,
      contact_phone,
      nationality,
      total_price,
    });

    return res.status(201).json({
      success: true,
      message: "Booking successfully created",
      data: newBooking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while creating booking" });
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await ActivityBooking.findByPk(id);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error("Error fetching booking by ID:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while fetching booking" });
  }
};

// Get all bookings for a specific tourist user
exports.getBookingsByUser = async (req, res) => {
  try {
    const { tourist_user_id } = req.params;
    const bookings = await ActivityBooking.findAll({
      where: { tourist_user_id },
    });

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No bookings found for this user" });
    }

    return res.json({ success: true, data: bookings });
  } catch (error) {
    console.error("Error fetching bookings for user:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while fetching bookings",
      });
  }
};
