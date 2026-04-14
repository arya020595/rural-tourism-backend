const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const operatorActivityService = require("../services/operatorActivityService");

const getRequesterContext = (req) => {
  const requesterId = Number(
    req.user?.user_type === "operator"
      ? (req.user?.unified_user_id ?? req.user?.id)
      : (req.user?.legacy_user_id ?? req.user?.id),
  );
  return {
    requesterId: Number.isNaN(requesterId) ? null : requesterId,
    isAdmin: req.user?.role === "admin",
  };
};

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
    // Note: Service now preserves associations, no need for lookup
    const result = filteredActivities.map((activity) => {
      return {
        ...activity,
        activity_name: activity.activity_master
          ? activity.activity_master.activity_name
          : "Unknown",
        location: activity.address,
      };
    });

    res.json(result);
  } catch (err) {
    // Return 400 for invalid date filters
    if (err.message && err.message.includes("Invalid")) {
      return res.status(400).json({ error: err.message });
    }
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
      where: { user_id },
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
      user_id: activity.user_id,
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
 * @query {string} date - Optional single date filter (YYYY-MM-DD)
 * @query {string} startDate - Optional start of date range (YYYY-MM-DD)
 * @query {string} endDate - Optional end of date range (YYYY-MM-DD)
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

    // Apply booking-aware filtering (including date filters if provided)
    const filters = {
      date: req.query.date,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const [filtered] = await operatorActivityService.applyBookingAwareFiltering(
      [activity],
      filters,
    );

    // If filtered out (no available dates match), return 404
    if (!filtered) {
      return res.status(404).json({
        error: "Activity not available for the specified dates",
      });
    }

    res.json({
      ...filtered,
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown",
      location: filtered.address,
      user_id: filtered.user_id,
    });
  } catch (err) {
    // Return 400 for invalid date filters
    if (err.message && err.message.includes("Invalid")) {
      return res.status(400).json({ error: err.message });
    }
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
    const { requesterId, isAdmin } = getRequesterContext(req);

    if (!isAdmin && requesterId === null) {
      return res.status(401).json({ error: "Unauthorized user context." });
    }

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

    const payloadUserId = user_id;

    if (
      !isAdmin &&
      payloadUserId !== undefined &&
      payloadUserId !== null &&
      String(payloadUserId) !== String(requesterId)
    ) {
      return res.status(403).json({
        error:
          "Forbidden. You can only create activities for your own account.",
      });
    }

    const finalUserId = isAdmin ? payloadUserId : requesterId;
    if (!finalUserId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    // Resolve the referenced activity master record.
    let masterActivityId = null;

    if (
      activity_id !== undefined &&
      activity_id !== null &&
      activity_id !== ""
    ) {
      const parsedActivityId = Number(activity_id);
      if (Number.isNaN(parsedActivityId) || parsedActivityId <= 0) {
        return res.status(400).json({ error: "Invalid activity_id." });
      }
      masterActivityId = parsedActivityId;
    }

    if (!masterActivityId && activity_name) {
      const masterActivity = await ActivityMasterData.findOne({
        where: { activity_name },
      });
      if (masterActivity) {
        masterActivityId = masterActivity.id;
      }
    }

    if (!masterActivityId) {
      return res.status(400).json({
        error: "A valid activity_id or existing activity_name is required.",
      });
    }

    // Create activity
    const newActivity = await OperatorActivity.create({
      activity_id: masterActivityId,
      user_id: finalUserId,
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
      user_id: newActivity.user_id,
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

    const { requesterId, isAdmin } = getRequesterContext(req);
    if (!isAdmin && Number(activity.user_id) !== requesterId) {
      return res.status(403).json({
        error: "Forbidden. You can only update your own activities.",
      });
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
    if (!isAdmin && user_id !== undefined) {
      return res.status(403).json({
        error: "Forbidden. Only admin can reassign activity ownership.",
      });
    }

    if (isAdmin && user_id !== undefined) activity.user_id = user_id;

    await activity.save();

    res.json({
      ...activity.dataValues,
      activity_name: activity_name || "Activity",
      user_id: activity.user_id,
      location: activity.address,
    });
  } catch (err) {
    console.error("Error updating activity:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all operator activities by activity master ID
 * @route GET /api/operator-activities/activity/:activityId
 * @param {string} activityId - Activity Master ID
 */
exports.getOperatorActivitiesByActivityId = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activities = await OperatorActivity.findAll({
      where: { activity_id: activityId },
      include: [
        {
          model: ActivityMasterData,
          as: "activity_master",
          attributes: ["id", "activity_name", "description"],
        },
        {
          model: UnifiedUser,
          as: "operator",
          attributes: ["id", "name", "username"],
          required: false,
          include: [
            {
              model: Company,
              as: "company",
              attributes: ["company_name", "operator_logo_image"],
              required: false,
            },
          ],
        },
      ],
    });

    // Format response for frontend
    const result = activities.map((activity) => {
      // Parse JSON fields using shared helper
      const availableDates = operatorActivityService.parseJSONField(
        activity.available_dates,
      );
      const servicesList = operatorActivityService.parseJSONField(
        activity.services_provided,
      );

      return {
        ...activity.dataValues,
        activity_name: activity.activity_master
          ? activity.activity_master.activity_name
          : "Unknown",
        location: activity.address,
        user_id: activity.user_id,
        // Include business_name from operator association
        business_name:
          activity.operator?.company?.company_name ||
          activity.operator?.name ||
          "No Business Name",
        operator_name:
          activity.operator?.company?.company_name ||
          activity.operator?.name ||
          "Unknown Operator",
        company_logo: activity.operator?.company?.operator_logo_image || null,
        // Include parsed arrays for frontend
        available_dates_list: availableDates,
        activity_slots: availableDates,
        services_provided_list: servicesList,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching operator activities by activity ID:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get single operator activity by ID
 * @route GET /api/operator-activities/:id
 * @param {string} id - Operator Activity ID
 * @query {boolean} includeUser - Whether to include user data
 */
exports.getOperatorActivityById = async (req, res) => {
  try {
    const { id } = req.params;
    const includeUser = req.query.includeUser === "true";

    const includeOptions = [
      {
        model: ActivityMasterData,
        as: "activity_master",
        attributes: ["id", "activity_name", "description"],
      },
    ];

    if (includeUser) {
      includeOptions.push({
        model: UnifiedUser,
        as: "operator",
        attributes: ["id", "name", "username"],
        required: false,
        include: [
          {
            model: Company,
            as: "company",
            attributes: ["company_name", "operator_logo_image"],
            required: false,
          },
        ],
      });
    }

    const activity = await OperatorActivity.findOne({
      where: { id },
      include: includeOptions,
    });

    if (!activity) {
      return res.status(404).json({ error: "Operator activity not found." });
    }

    // Parse JSON fields using shared helper
    const availableDates = operatorActivityService.parseJSONField(
      activity.available_dates,
    );
    const servicesList = operatorActivityService.parseJSONField(
      activity.services_provided,
    );

    const result = {
      ...activity.dataValues,
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown",
      location: activity.address,
      user_id: activity.user_id,
      // Include business_name from operator association
      business_name:
        activity.operator?.company?.company_name ||
        activity.operator?.name ||
        "No Business Name",
      operator_name:
        activity.operator?.company?.company_name ||
        activity.operator?.name ||
        "Unknown Operator",
      rt_user: activity.operator
        ? {
            user_id: activity.operator.id,
            business_name: activity.operator.company?.company_name || null,
            full_name: activity.operator.name,
            company_logo:
              activity.operator.company?.operator_logo_image || null,
          }
        : null,
      // Include parsed arrays for frontend
      available_dates_list: availableDates,
      activity_slots: availableDates,
      services_provided_list: servicesList,
    };

    res.json(result);
  } catch (err) {
    console.error("Error fetching operator activity by ID:", err);
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

    const { requesterId, isAdmin } = getRequesterContext(req);
    if (!isAdmin && Number(activity.user_id) !== requesterId) {
      return res.status(403).json({
        error: "Forbidden. You can only delete your own activities.",
      });
    }

    await activity.destroy();
    res.json({ message: "Activity deleted successfully." });
  } catch (err) {
    console.error("Error deleting activity:", err);
    res.status(500).json({ error: err.message });
  }
};
