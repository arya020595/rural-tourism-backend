const OperatorActivity = require("../models/operatorActivitiesModel"); // updated import
const RtUser = require("../models/userModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const ActivityBooking = require("../models/bookingActivityModel");
const { Op } = require("sequelize");

// Helper to safely parse JSON fields
function parseJSONField(field) {
  if (!field) return [];
  try {
    return typeof field === "string" ? JSON.parse(field) : field;
  } catch {
    return [];
  }
}

// Helper to get booked dates for a specific operator activity
async function getBookedDatesForActivity(operatorActivityId) {
  try {
    const bookings = await ActivityBooking.findAll({
      where: {
        operator_activity_id: operatorActivityId,
        status: { [Op.in]: ["confirmed", "completed"] }, // Only confirmed and completed bookings block dates
      },
      attributes: ["date"],
    });

    // Extract and format dates
    return bookings
      .map((booking) => booking.date)
      .filter((date) => date != null)
      .map((date) => {
        // Ensure consistent date format (YYYY-MM-DD)
        const d = new Date(date);
        return d.toISOString().split("T")[0];
      });
  } catch (err) {
    console.error("Error fetching booked dates:", err);
    return [];
  }
}

// Helper to filter out booked dates from available dates
function filterAvailableDates(availableDates, bookedDates) {
  if (!availableDates || !Array.isArray(availableDates)) return [];
  if (!bookedDates || bookedDates.length === 0) return availableDates;

  // Normalize all dates to YYYY-MM-DD format for comparison
  const normalizeDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  const bookedDatesSet = new Set(
    bookedDates.map((d) => normalizeDate(d)).filter(Boolean),
  );

  return availableDates.filter((dateStr) => {
    const normalized = normalizeDate(dateStr);
    return normalized && !bookedDatesSet.has(normalized);
  });
}

// Helper to check if activity matches date filter
function matchesDateFilter(
  actualAvailableDates,
  filterStartDate,
  filterEndDate,
) {
  if (!filterStartDate && !filterEndDate) return true;
  if (!actualAvailableDates || actualAvailableDates.length === 0) return false;

  const filterStart = filterStartDate ? new Date(filterStartDate) : null;
  const filterEnd = filterEndDate ? new Date(filterEndDate) : null;

  if (filterStart) filterStart.setHours(0, 0, 0, 0);
  if (filterEnd) filterEnd.setHours(23, 59, 59, 999);

  // Check if any actual available date falls within the filter range
  return actualAvailableDates.some((dateStr) => {
    try {
      const availableDate = new Date(dateStr);
      availableDate.setHours(0, 0, 0, 0);

      if (filterStart && filterEnd) {
        return availableDate >= filterStart && availableDate <= filterEnd;
      } else if (filterStart) {
        return availableDate >= filterStart;
      } else if (filterEnd) {
        return availableDate <= filterEnd;
      }
      return true;
    } catch {
      return false;
    }
  });
}

// 1️⃣ Get all operator activities with booking-aware date filtering
exports.getAllOperatorActivities = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;

    const activities = await OperatorActivity.findAll();

    // Process each activity to filter out booked dates
    const processedActivities = await Promise.all(
      activities.map(async (activity) => {
        const bookedDates = await getBookedDatesForActivity(activity.id);
        const originalAvailableDates = parseJSONField(activity.available_dates);
        const actualAvailableDates = filterAvailableDates(
          originalAvailableDates,
          bookedDates,
        );

        // Apply date filter if provided
        if (date || startDate || endDate) {
          const filterStart = date || startDate;
          const filterEnd = date || endDate;

          if (
            !matchesDateFilter(actualAvailableDates, filterStart, filterEnd)
          ) {
            return null; // Exclude this activity from results
          }
        }

        return {
          ...activity.dataValues,
          available_dates: actualAvailableDates,
          available_dates_list: actualAvailableDates,
        };
      }),
    );

    // Filter out null entries (activities that didn't match the date filter)
    const filteredActivities = processedActivities.filter(
      (activity) => activity !== null,
    );

    res.json(filteredActivities);
  } catch (err) {
    console.error("Error fetching operator activities:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2️⃣ Get operator activity by activity_id and include business_name from rt_user with booking-aware filtering
exports.getOperatorsByActivityId = async (req, res) => {
  const { activity_id } = req.params;
  const { startDate, endDate, date } = req.query;

  try {
    const operators = await OperatorActivity.findAll({
      where: { activity_id },
      include: [
        {
          model: RtUser,
          as: "rt_user",
          attributes: ["user_id", "business_name"],
        },
      ],
    });

    if (!operators || operators.length === 0) {
      return res
        .status(404)
        .json({ error: "No operators found for this activity." });
    }

    // Process each operator to filter out booked dates
    const processedOperators = await Promise.all(
      operators.map(async (op) => {
        const bookedDates = await getBookedDatesForActivity(op.id);
        const originalAvailableDates = parseJSONField(op.available_dates);
        const actualAvailableDates = filterAvailableDates(
          originalAvailableDates,
          bookedDates,
        );

        // Apply date filter if provided
        if (date || startDate || endDate) {
          const filterStart = date || startDate;
          const filterEnd = date || endDate;

          if (
            !matchesDateFilter(actualAvailableDates, filterStart, filterEnd)
          ) {
            return null; // Exclude this operator from results
          }
        }

        return {
          ...op.dataValues,
          rt_user_id: op.rt_user ? op.rt_user.user_id : null,
          business_name: op.rt_user ? op.rt_user.business_name : "Not Provided",
          services_provided_list: parseJSONField(op.services_provided),
          available_dates: actualAvailableDates,
          available_dates_list: actualAvailableDates,
        };
      }),
    );

    // Filter out null entries
    const result = processedOperators.filter((op) => op !== null);

    if (result.length === 0) {
      return res
        .status(404)
        .json({ error: "No operators available for the selected date(s)." });
    }

    res.json(result);
  } catch (err) {
    console.error("Error fetching operators with business names:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get single operator activity by operator ID with booking-aware filtering
exports.getOperatorActivityById = async (req, res) => {
  const { id } = req.params;

  try {
    const operator = await OperatorActivity.findOne({
      where: { id },
      include: [
        {
          model: RtUser,
          as: "rt_user",
          attributes: ["business_name"],
        },
      ],
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator activity not found." });
    }

    // Get booked dates and filter available dates
    const bookedDates = await getBookedDatesForActivity(operator.id);
    const originalAvailableDates = parseJSONField(operator.available_dates);
    const actualAvailableDates = filterAvailableDates(
      originalAvailableDates,
      bookedDates,
    );

    res.json({
      ...operator.dataValues,
      business_name: operator.rt_user
        ? operator.rt_user.business_name
        : "Not Provided",
      services_provided_list: parseJSONField(operator.services_provided),
      available_dates: actualAvailableDates,
      available_dates_list: actualAvailableDates,
    });
  } catch (err) {
    console.error("Error fetching operator activity by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

// exports.getOperatorActivityById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const operator = await OperatorActivity.findOne({
//       where: { id },
//       include: [
//         {
//           model: RtUser,
//           as: 'rt_user',
//           attributes: ['business_name']
//         }
//       ]
//     });

//     if (!operator) {
//       return res.status(404).json({ error: 'Operator activity not found.' });
//     }

//     res.json({
//       ...operator.dataValues,
//       business_name: operator.rt_user ? operator.rt_user.business_name : 'Not Provided'
//     });
//   } catch (err) {
//     console.error('Error fetching operator activity by ID:', err);
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.getOperatorsByActivityId = async (req, res) => {
//     const { activity_id } = req.params;

//     try {
//         // 1️⃣ Fetch operator activities
//         const operators = await OperatorActivity.findAll({ where: { activity_id } });

//         if (!operators.length) {
//             return res.status(404).json({ error: 'No operators found for this activity.' });
//         }

//         // 2️⃣ Get all user IDs from operators
//         const userIds = operators.map(op => op.rt_user_id);

//         // 3️⃣ Fetch users
//         const users = await RtUser.findAll({
//             where: { user_id: userIds },
//             attributes: ['user_id', 'business_name']
//         });

//         // 4️⃣ Merge business_name into operators
//         const result = operators.map(op => {
//             const user = users.find(u => u.user_id === op.rt_user_id);
//             return { ...op.dataValues, business_name: user?.business_name || 'Not Provided' };
//         });

//         res.json(result);

//     } catch (err) {
//         console.error('Error fetching operators:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

// exports.getOperatorActivityById = async (req, res) => {
//     const { id } = req.params;
//     try {
//         const activity = await OperatorActivity.findOne({ where: { id } });

//         if (!activity) {
//             return res.status(404).json({ error: 'Operator activity not found.' });
//         }

//         res.json(activity);
//     } catch (err) {
//         console.error('Error fetching operator activity by ID:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

// 3️⃣ Create a new operator activity
exports.createOperatorActivity = async (req, res) => {
  try {
    const newActivity = await OperatorActivity.create(req.body);
    res.status(201).json(newActivity);
  } catch (err) {
    console.error("Error creating operator activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// 4️⃣ Update an existing operator activity
exports.updateOperatorActivity = async (req, res) => {
  const { id } = req.params;

  try {
    const activity = await OperatorActivity.findOne({ where: { id } });

    if (!activity) {
      return res.status(404).json({ error: "Operator activity not found." });
    }

    // Update only provided fields
    const updatableFields = [
      "description",
      "address",
      "district",
      "image",
      "operator_logo",
      "services_provided",
      "price_per_pax",
      "activity_id",
      "rt_user_id",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) activity[field] = req.body[field];
    });

    await activity.save();
    res.json(activity);
  } catch (err) {
    console.error("Error updating operator activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// 5️⃣ Delete an operator activity
exports.deleteOperatorActivity = async (req, res) => {
  const { id } = req.params;

  try {
    const activity = await OperatorActivity.findOne({ where: { id } });

    if (!activity) {
      return res.status(404).json({ error: "Operator activity not found." });
    }

    await activity.destroy();
    res.json({ message: "Operator activity deleted successfully." });
  } catch (err) {
    console.error("Error deleting operator activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// 6️⃣ Get all operator activities by user (includes activity_name from activity_master_table) with booking-aware filtering
exports.getAllOperatorActivitiesByUser = async (req, res) => {
  const { rt_user_id } = req.params;
  const { startDate, endDate, date } = req.query;

  try {
    const activities = await OperatorActivity.findAll({
      where: { rt_user_id },
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
      ],
    });

    if (!activities || activities.length === 0) {
      return res
        .status(404)
        .json({ error: "No activities found for this user." });
    }

    // Process each activity to filter out booked dates
    const processedActivities = await Promise.all(
      activities.map(async (activity) => {
        const bookedDates = await getBookedDatesForActivity(activity.id);
        const originalAvailableDates = parseJSONField(activity.available_dates);
        const actualAvailableDates = filterAvailableDates(
          originalAvailableDates,
          bookedDates,
        );

        // Apply date filter if provided
        if (date || startDate || endDate) {
          const filterStart = date || startDate;
          const filterEnd = date || endDate;

          if (
            !matchesDateFilter(actualAvailableDates, filterStart, filterEnd)
          ) {
            return null; // Exclude this activity from results
          }
        }

        return {
          ...activity.dataValues,
          activity_name: activity.activity_master
            ? activity.activity_master.activity_name
            : "Unknown Activity",
          location: activity.address,
          services_provided_list: parseJSONField(activity.services_provided),
          available_dates: actualAvailableDates,
          available_dates_list: actualAvailableDates,
        };
      }),
    );

    // Filter out null entries
    const result = processedActivities.filter((activity) => activity !== null);

    if (result.length === 0 && (date || startDate || endDate)) {
      return res
        .status(404)
        .json({ error: "No activities available for the selected date(s)." });
    }

    res.json(result);
  } catch (err) {
    console.error("Error fetching activities by user:", err);
    res.status(500).json({ error: err.message });
  }
};

// 7️⃣ Get all operator activities by activity ID
// exports.getOperatorsByActivityId = async (req, res) => {
//     const { activity_id } = req.params;  // or req.query if you want query param

//     try {
//         const activities = await OperatorActivity.findAll({ where: { activity_id } });

//         if (!activities || activities.length === 0) {
//             return res.status(404).json({ error: 'No operators found for this activity.' });
//         }

//         res.json(activities);
//     } catch (err) {
//         console.error('Error fetching operators by activity ID:', err);
//         res.status(500).json({ error: err.message });
//     }
// };
