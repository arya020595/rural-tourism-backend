const ActivityBooking = require("../models/bookingActivityModel");
const AccommodationBooking = require("../models/bookingAccommodationModel");
const Accom = require("../models/accomModel");
const OperatorActivity = require("../models/operatorActivitiesModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const ActivityMasterData = require("../models/activityMasterDataModel"); 


/**
 * Get all bookings (activities + accommodations) for a tourist
 * by their user ID.
 */
  exports.getAllBookingsForTourist = async (req, res) => {
    const touristId = req.params.tourist_user_id;
    if (!touristId) {
      return res.status(400).json({ success: false, message: "Tourist ID required" });
    }

    try {
      // Fetch activity + accommodation bookings from Sequelize
  const activityBookings = await ActivityBooking.findAll({
    where: { tourist_user_id: touristId },
    include: [
      {
        model: OperatorActivity,
        as: 'operatorActivity', // must match your OperatorActivity.belongsTo association
        include: [
          {
            model: ActivityMasterData, // import this as Activity
            as: 'activity',
            attributes: ['id', 'activity_name'], // match DB column
          },
          {
            model: UnifiedUser,
            as: 'operator',
            attributes: ['id', 'name', 'username'],
            include: [
              {
                model: Company,
                as: 'company',
                attributes: ['company_name'],
                required: false,
              },
            ],
          },
        ],
      },
    ],
  });


    const accomBookings = await AccommodationBooking.findAll({
      where: { tourist_user_id: touristId },
      include: [
        {
          model: Accom,
          attributes: ["name"],
        },
      ],
    });

    // Combine into one array with a `type` field
      const bookings = [
        ...activityBookings.map(b => ({
        ...b.dataValues,
        activityName: b.operatorActivity?.activity?.activity_name,
        operatorName:
          b.operatorActivity?.operator?.company?.company_name ||
          b.operatorActivity?.operator?.name ||
          b.operatorActivity?.operator?.username,
        type: 'activity',
      })),

        // ...activityBookings.map(b => ({
        //   ...b.dataValues,
        //   type: 'activity',
        // })),
        ...accomBookings.map(b => ({
          ...b.dataValues,
          accommodation_name: b.accommodation?.name,
          type: 'accommodation',
        })),
      ];

    // Return as JSON
    return res.json({ success: true, data: bookings });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.cancelActivityBooking = async (req, res) => {
  try {
    const booking = await ActivityBooking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.status = "Cancelled"; // or "Canceled" depending on your naming
    await booking.save();

    return res.json({ success: true, message: "Activity booking cancelled", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.cancelAccommodationBooking = async (req, res) => {
  try {
    const booking = await AccommodationBooking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.status = "Cancelled"; 
    await booking.save();

    return res.json({ success: true, message: "Accommodation booking cancelled", booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

