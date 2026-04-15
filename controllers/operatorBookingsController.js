const ActivityBooking = require("../models/bookingActivityModel");
const AccommodationBooking = require("../models/bookingAccommodationModel");
const OperatorActivity = require("../models/operatorActivitiesModel");
const Accom = require("../models/accomModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const ActivityMasterData = require("../models/activityMasterDataModel"); // For activity details
const FormResponse = require("../models/formModel");

/**
 * Get all bookings (activities + accommodations) for an operator
 */
exports.getAllBookingsForOperator = async (req, res) => {
  const operatorId = req.params.operator_user_id;

  if (!operatorId) {
    return res
      .status(400)
      .json({ success: false, message: "Operator ID required" });
  }

  try {
    // --- ACTIVITY BOOKINGS ---
    const activityBookings = await ActivityBooking.findAll({
      include: [
        {
          model: OperatorActivity,
          as: "operatorActivity",
          where: { user_id: operatorId },
          include: [
            {
              model: ActivityMasterData,
              as: "activity",
              attributes: ["id", "activity_name"],
            },
            {
              model: UnifiedUser,
              as: "operator",
              attributes: ["id", "name", "username"],
              include: [
                {
                  model: Company,
                  as: "company",
                  attributes: ["company_name"],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: FormResponse,
          as: "formResponse",
          required: false, // LEFT JOIN — don't exclude unpaid bookings
          attributes: ["receipt_id"],
          foreignKey: "activity_booking_id",
        },
      ],
    });

    // --- ACCOMMODATION BOOKINGS ---
    const accomBookings = await AccommodationBooking.findAll({
      include: [
        {
          model: Accom,
          as: "accommodation",
          where: { user_id: operatorId },
          attributes: ["name"],
        },
        {
          model: FormResponse,
          as: "formResponse",
          required: false,
          attributes: ["receipt_id"],
        },
      ],
    });

    // --- COMBINE BOTH ---
    const bookings = [
      ...activityBookings.map((b) => ({
        ...b.dataValues,
        type: "activity",
        receipt_id: b.formResponse?.receipt_id || null,
        activity_name: b.operatorActivity?.activity?.activity_name,
        activityName: b.operatorActivity?.activity?.activity_name,
        operatorName:
          b.operatorActivity?.operator?.company?.company_name ||
          b.operatorActivity?.operator?.name ||
          b.operatorActivity?.operator?.username,
        location: b.operatorActivity?.address || "",
        citizenship: b.nationality || "",
      })),
      ...accomBookings.map((b) => ({
        ...b.dataValues,
        type: "accommodation",
        receipt_id: b.formResponse?.receipt_id || null,
        accommodation_name: b.accommodation?.name,
        citizenship: b.nationality || "",
      })),
    ];

    return res.json({ success: true, data: bookings });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Mark activity booking as paid
 */
exports.markActivityPaid = async (req, res) => {
  try {
    const booking = await ActivityBooking.findByPk(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    booking.status = "paid";
    await booking.save();

    return res.json({
      success: true,
      message: "Activity booking marked as paid",
      booking,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Mark accommodation booking as paid
 */
exports.markAccommodationPaid = async (req, res) => {
  try {
    const booking = await AccommodationBooking.findByPk(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    booking.status = "paid";
    await booking.save();

    return res.json({
      success: true,
      message: "Accommodation booking marked as paid",
      booking,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
