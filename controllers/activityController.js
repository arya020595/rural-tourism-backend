const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const operatorActivityService = require("../services/operatorActivityService");
const { v4: uuidv4 } = require("uuid");

/**
 * Activity Controller
 * Handles HTTP requests for activity-related endpoints
 * Delegates business logic to operatorActivityService
 */

/**
 * Get all activities with booking-aware filtering
 * @route GET /api/activity
 * @query {string} date - Single date filter (YYYY-MM-DD)
 * @query {string} startDate - Start date for range filter
 * @query {string} endDate - End date for range filter
 */
exports.getAllActivities = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;

    // Fetch activities with master data
    const activities = await OperatorActivity.findAll({
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
      ],
    });

    // Apply booking-aware filtering via service
    const filteredActivities =
      await operatorActivityService.applyBookingAwareFiltering(activities, {
        date,
        startDate,
        endDate,
      });

    // Format response for frontend
    const result = filteredActivities.map((activity) => {
      const original = activities.find((a) => a.id === activity.id);
      return {
        ...activity,
        activity_name: original?.activity_master
          ? original.activity_master.activity_name
          : "Unknown",
        location: original?.address,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching activities:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get activities for a specific user
 * @route GET /api/activity/user/:user_id
 * @param {string} user_id - User ID
 */
exports.getActivitiesByUser = async (req, res) => {
  try {
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

    // Format response
    const result = activities.map((activity) => ({
      ...activity.dataValues,
      activity_id: activity.id,
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown",
      location: activity.address,
      user_id: activity.rt_user_id,
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching activities by user:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get single activity by ID
 * @route GET /api/activity/:id
 * @param {string} id - Activity ID
 */
exports.getActivityById = async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error fetching activity by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create a new activity
 * @route POST /api/activity
 * @body {object} activity - Activity data
 */
exports.createActivity = async (req, res) => {
  try {
    const {
      activity_id,
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

    // Generate unique ID if not provided
    const id = activity_id || `act_${uuidv4().substring(0, 8)}`;

    // Find activity master ID
    let masterActivityId = 1;
    if (activity_name) {
      const masterActivity = await ActivityMasterData.findOne({
        where: { activity_name },
      });
      if (masterActivity) {
        masterActivityId = masterActivity.id;
      }
    }

    // Create activity
    const newActivity = await OperatorActivity.create({
      id,
      activity_id: masterActivityId,
      rt_user_id: user_id,
      description: description || "",
      address: address || location || "",
      district: district || "",
      image: image || null,
      services_provided: services_provided || things_to_know || "[]",
      available_dates: available_dates || [],
      price_per_pax: price || null,
    });

    // Format response
    res.status(201).json({
      ...newActivity.dataValues,
      activity_id: newActivity.id,
      activity_name: activity_name || "Activity",
      user_id: newActivity.rt_user_id,
      location: newActivity.address,
    });
  } catch (err) {
    console.error("Error creating activity:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update an activity
 * @route PUT /api/activity/:id
 * @param {string} id - Activity ID
 * @body {object} updates - Activity updates
 */
exports.updateActivity = async (req, res) => {
  try {
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
    if (!activity) {
      return res.status(404).json({ error: "Activity not found." });
    }

    // Update fields
    if (description !== undefined) activity.description = description;
    if (address !== undefined) activity.address = address;
    if (location !== undefined) activity.address = location;
    if (district !== undefined) activity.district = district;
    if (image !== undefined) activity.image = image;
    if (services_provided !== undefined)
      activity.services_provided = services_provided;
    if (things_to_know !== undefined)
      activity.services_provided = things_to_know;
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
  } catch (err) {
    console.error("Error updating activity:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete an activity
 * @route DELETE /api/activity/:id
 * @param {string} id - Activity ID
 */
exports.deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await OperatorActivity.findOne({ where: { id } });
    if (!activity) {
      return res.status(404).json({ error: "Activity not found." });
    }

    await activity.destroy();
    res.json({ message: "Activity deleted successfully." });
  } catch (err) {
    console.error("Error deleting activity:", err);
    res.status(500).json({ error: err.message });
  }
};
