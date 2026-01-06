const express = require("express");
const router = express.Router();
const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const { v4: uuidv4 } = require("uuid");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 1. Get all activities (returns operator activities with activity names)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const activities = await OperatorActivity.findAll({
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
      ],
    });

    // Map to frontend expected format
    const result = activities.map((activity) => ({
      ...activity.dataValues,
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown",
      location: activity.address,
    }));

    res.json(result);
  })
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
  })
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
  })
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
  })
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
  })
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
  })
);

module.exports = router;
