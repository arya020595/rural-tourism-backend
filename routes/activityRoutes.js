const express = require("express");
const router = express.Router();
const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const ActivityBooking = require("../models/bookingActivityModel");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Helper to parse JSON fields
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

    return bookings
      .map((booking) => booking.date)
      .filter((date) => date != null)
      .map((date) => {
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

/**
 * 1. Get all activities (returns operator activities with activity names)
 * Supports booking-aware date filtering via query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { startDate, endDate, date } = req.query;

    const activities = await OperatorActivity.findAll({
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
      ],
    });

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
            : "Unknown",
          location: activity.address,
          available_dates: actualAvailableDates,
        };
      }),
    );

    // Filter out null entries (activities that didn't match the date filter)
    const result = processedActivities.filter((activity) => activity !== null);

    res.json(result);
  }),
);

/**
 * 2. Get all activities for a specific user
 * Frontend sends: user_id
 * Backend uses: rt_user_id
 */
router.get(
  "/user/:user_id",
  asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const activities = await OperatorActivity.findAll({
      where: { rt_user_id: user_id },
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
      ],
    });

    if (activities.length === 0) {
      return res
        .status(404)
        .json({ error: "No activities found for this user." });
    }

    // Map to frontend expected format
    const result = activities.map((activity) => ({
      ...activity.dataValues,
      activity_id: activity.id, // Frontend expects activity_id
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown",
      location: activity.address,
      user_id: activity.rt_user_id, // Provide user_id alias for frontend
    }));

    res.json(result);
  }),
);

/**
 * 3. Get a single activity by ID
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const activity = await OperatorActivity.findOne({
      where: { id },
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
      ],
    });

    if (!activity) {
      return res.status(404).json({ error: "Activity not found." });
    }

    res.json({
      ...activity.dataValues,
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown",
      location: activity.address,
      user_id: activity.rt_user_id,
    });
  }),
);

/**
 * 4. Create a new activity
 * Frontend sends: activity_id, activity_name, description, price, image, district, things_to_know, user_id
 * Backend maps to: id, activity_id (from master), rt_user_id, description, address, district, image, services_provided, available_dates, price_per_pax
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      activity_id, // Frontend's generated ID (e.g., act_12345678)
      activity_name,
      description,
      price,
      image,
      district,
      things_to_know,
      user_id,
      address,
      location,
      services_provided,
      available_dates,
    } = req.body;

    // Generate a unique ID if not provided
    const id = activity_id || `act_${uuidv4().substring(0, 8)}`;

    // Try to find activity_master_id by activity_name, or use 1 as default
    let masterActivityId = 1;
    if (activity_name) {
      const masterActivity = await ActivityMasterData.findOne({
        where: { activity_name },
      });
      if (masterActivity) {
        masterActivityId = masterActivity.id;
      }
    }

    const newActivity = await OperatorActivity.create({
      id,
      activity_id: masterActivityId, // Reference to activity_master_table
      rt_user_id: user_id, // Map user_id to rt_user_id
      description: description || "",
      address: address || location || "", // Use address or location
      district: district || "",
      image: image || null,
      services_provided: services_provided || things_to_know || "[]",
      available_dates: available_dates || [],
      price_per_pax: price || null,
    });

    // Return in frontend expected format
    res.status(201).json({
      ...newActivity.dataValues,
      activity_id: newActivity.id, // Frontend expects activity_id
      activity_name: activity_name || "Activity",
      user_id: newActivity.rt_user_id,
      location: newActivity.address,
    });
  }),
);

/**
 * 5. Update an activity by ID
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      activity_name,
      description,
      price,
      image,
      district,
      things_to_know,
      user_id,
      address,
      location,
      services_provided,
      available_dates,
    } = req.body;

    const activity = await OperatorActivity.findOne({ where: { id } });
    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    // Update only provided fields
    if (description !== undefined) activity.description = description;
    if (address !== undefined) activity.address = address;
    if (location !== undefined) activity.address = location;
    if (district !== undefined) activity.district = district;
    if (image !== undefined) activity.image = image;
    if (services_provided !== undefined)
      activity.services_provided = services_provided;
    if (things_to_know !== undefined) activity.things_to_know = things_to_know;
    if (available_dates !== undefined)
      activity.available_dates = available_dates;
    if (price !== undefined) activity.price_per_pax = price;
    if (user_id !== undefined) activity.rt_user_id = user_id;

    await activity.save();

    res.json({
      ...activity.dataValues,
      activity_name: activity_name || "Activity",
      user_id: activity.rt_user_id,
      location: activity.address,
    });
  }),
);

/**
 * 6. Delete an activity by ID
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const activity = await OperatorActivity.findOne({ where: { id } });
    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    await activity.destroy();
    res.json({ message: "Activity deleted successfully." });
  }),
);

module.exports = router;
