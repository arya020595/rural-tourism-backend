const OperatorActivity = require("../models/operatorActivitiesModel");
const UnifiedUser = require("../models/unifiedUserModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const Company = require("../models/companyModel");

/**
 * Safely parse a JSON string field into an array.
 * Returns [] if the input is falsy, already an array, or invalid JSON.
 */
function parseJSONField(field) {
  if (!field) return [];
  try {
    return typeof field === "string" ? JSON.parse(field) : field;
  } catch {
    return [];
  }
}

/**
 * Extract price_per_pax from the first entry in available_dates.
 * Falls back to 0 if no dates or no price found.
 */
function derivePriceFromDates(availableDates) {
  const dates = parseJSONField(availableDates);
  return dates.length > 0 && dates[0] != null && dates[0].price != null
    ? dates[0].price
    : 0;
}

// Get all operator activities
exports.getAllOperatorActivities = async (req, res) => {
  try {
    const activities = await OperatorActivity.findAll();
    res.json(activities);
  } catch (err) {
    console.error("Error fetching operator activities:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get operators by activity master ID (includes business_name from unified user company)
exports.getOperatorsByActivityId = async (req, res) => {
  const { activityId: activity_id } = req.params;

  try {
    const operators = await OperatorActivity.findAll({
      where: { activity_id },
      include: [
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

    if (!operators || operators.length === 0) {
      return res
        .status(404)
        .json({ error: "No operators found for this activity." });
    }

    const result = operators.map((op) => ({
      ...op.dataValues,
      user_id: op.user_id,
      business_name:
        op.operator?.company?.company_name || op.operator?.name || "Not Provided",
      operator_name:
        op.operator?.company?.company_name || op.operator?.name || "Unknown Operator",
      company_logo: op.operator?.company?.operator_logo_image || null,
      services_provided_list: parseJSONField(op.services_provided),
      available_dates_list: parseJSONField(op.available_dates),
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching operators with business names:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get single operator activity by operator ID
exports.getOperatorActivityById = async (req, res) => {
  const { id } = req.params;

  try {
    const operator = await OperatorActivity.findOne({
      where: { id },
      include: [
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

    if (!operator) {
      return res.status(404).json({ error: "Operator activity not found." });
    }

    res.json({
      ...operator.dataValues,
      user_id: operator.user_id,
      business_name:
        operator.operator?.company?.company_name ||
        operator.operator?.name ||
        "Not Provided",
      services_provided_list: parseJSONField(operator.services_provided),
      available_dates_list: parseJSONField(operator.available_dates),
    });
  } catch (err) {
    console.error("Error fetching operator activity by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

// Create a new operator activity
exports.createOperatorActivity = async (req, res) => {
  try {
    const {
      activity_id,
      user_id,
      address,
      price_per_pax,
      available_dates,
    } = req.body;

    const ownerUserId = user_id;

    if (!ownerUserId) {
      return res
        .status(400)
        .json({ error: "user_id is required. Please login again." });
    }
    if (!activity_id) {
      return res.status(400).json({ error: "activity_id is required." });
    }

    const newActivity = await OperatorActivity.create({
      ...req.body,
      user_id: parseInt(ownerUserId, 10),
      activity_id: parseInt(activity_id, 10),
      address: address || "",
      price_per_pax: price_per_pax ?? derivePriceFromDates(available_dates),
    });
    res.status(201).json({
      ...newActivity.dataValues,
      user_id: newActivity.user_id,
    });
  } catch (err) {
    console.error("Error creating operator activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update an existing operator activity
exports.updateOperatorActivity = async (req, res) => {
  const { id } = req.params;

  try {
    const activity = await OperatorActivity.findOne({ where: { id } });

    if (!activity) {
      return res.status(404).json({ error: "Operator activity not found." });
    }

    const updatableFields = [
      "description",
      "address",
      "district",
      "image",
      "services_provided",
      "price_per_pax",
      "activity_id",
      "user_id",
      "available_dates",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        activity[field] = req.body[field];
      }
    });

    await activity.save();
    res.json({
      ...activity.dataValues,
      user_id: activity.user_id,
    });
  } catch (err) {
    console.error("Error updating operator activity:", err);
    res.status(500).json({ error: err.message });
  }
};

// Delete an operator activity
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

// Get all operator activities by user (includes activity_name from activity_master_table)
exports.getAllOperatorActivitiesByUser = async (req, res) => {
  const ownerUserId = req.params.user_id;

  try {
    const activities = await OperatorActivity.findAll({
      where: { user_id: ownerUserId },
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

    const result = activities.map((activity) => ({
      ...activity.dataValues,
      user_id: activity.user_id,
      activity_name: activity.activity_master
        ? activity.activity_master.activity_name
        : "Unknown Activity",
      location: activity.address,
      services_provided_list: parseJSONField(activity.services_provided),
      available_dates_list: parseJSONField(activity.available_dates),
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching activities by user:", err);
    res.status(500).json({ error: err.message });
  }
};
