const ActivityBooking = require("../models/bookingActivityModel");
const OperatorActivities = require("../models/operatorActivitiesModel");
const { Op } = require("sequelize");

// ===============================
// CREATE A NEW BOOKING
// ===============================
exports.createBooking = async (req, res) => {
  try {
    const {
      tourist_user_id,
      activity_id,
      operator_activity_id,
      operator_user_id,
      no_of_pax,
      date,
      time,
      contact_name,
      contact_phone,
      nationality,
      total_price,
      status,
    } = req.body;

    // ✅ Basic validation
    if (!tourist_user_id || !activity_id || !date || !time || !total_price) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 🔍 STEP 1: Resolve operator_activity_id FIRST
    let opActivityId = operator_activity_id;

    if (!opActivityId) {
      const operatorActivity = await OperatorActivities.findOne({
        where: {
          activity_id,
          ...(operator_user_id ? { rt_user_id: operator_user_id } : {}),
        },
      });

      if (!operatorActivity) {
        return res.status(404).json({
          success: false,
          message: "Operator activity not found for this activity",
        });
      }

      opActivityId = operatorActivity.id;
    }

    // 🔒 STEP 2: Prevent double booking (OPERATOR-SCOPED)
    const existingBooking = await ActivityBooking.findOne({
      where: {
        operator_activity_id: opActivityId, // ✅ NOW SAFE
        date,
        time,
        status: { [Op.notIn]: ["Cancelled", "Canceled"] },
      },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "This date and time is already booked",
      });
    }

    // ✅ STEP 3: Create booking
    const newBooking = await ActivityBooking.create({
      tourist_user_id,
      activity_id,
      operator_activity_id: opActivityId,
      no_of_pax,
      date,
      time,
      contact_name,
      contact_phone,
      nationality,
      total_price,
      status: status || "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Booking successfully created",
      data: newBooking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating booking",
      error: error.message,
    });
  }
};

// ===============================
// GET BOOKING BY ID
// ===============================
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await ActivityBooking.findByPk(id, {
      include: [
        { model: OperatorActivities, as: "operatorActivity" },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching booking by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching booking",
    });
  }
};

// ===============================
// GET BOOKINGS BY TOURIST USER
// ===============================
exports.getBookingsByUser = async (req, res) => {
  try {
    const { tourist_user_id } = req.params;

    const bookings = await ActivityBooking.findAll({
      where: { tourist_user_id },
      include: [
        {
          model: OperatorActivities,
          as: "operatorActivity",
        },
      ],
      order: [["date", "ASC"], ["time", "ASC"]],
    });

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings by user:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===============================
// GET BOOKED DATE + TIME BY ACTIVITY
// ===============================
exports.getBookedDatesByActivity = async (req, res) => {
  try {
    const { activity_id } = req.params;

    if (!activity_id) {
      return res.status(400).json({
        success: false,
        message: "Activity ID is required",
      });
    }

    const bookings = await ActivityBooking.findAll({
      where: {
        activity_id,
        status: { [Op.notIn]: ["Cancelled", "Canceled"] },
      },
      attributes: ["date", "time"],
    });

    const bookedSlots = bookings.map((b) => ({
      date: b.date,
      time: b.time,
    }));

    return res.json({
      success: true,
      data: bookedSlots,
    });
  } catch (error) {
    console.error("Error fetching booked slots:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ===============================
// GET BOOKED DATE + TIME BY OPERATOR ACTIVITY
// ===============================
exports.getBookedDatesByOperatorActivity = async (req, res) => {
  try {
    const { operator_activity_id } = req.params;

    if (!operator_activity_id) {
      return res.status(400).json({
        success: false,
        message: "operator_activity_id is required",
      });
    }

    const bookings = await ActivityBooking.findAll({
      where: {
        operator_activity_id, // 🔑 CORRECT SCOPE
        status: { [Op.notIn]: ["Cancelled", "Canceled"] },
      },
      attributes: ["date", "time"],
    });

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching booked slots by operator activity:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

