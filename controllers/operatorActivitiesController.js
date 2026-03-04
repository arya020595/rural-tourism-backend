const OperatorActivity = require("../models/operatorActivitiesModel"); // updated import
const RtUser = require("../models/userModel");
const ActivityMasterData = require("../models/activityMasterDataModel");

// Helper to safely parse JSON fields
function parseJSONField(field) {
  if (!field) return [];
  try {
    return typeof field === "string" ? JSON.parse(field) : field;
  } catch {
    return [];
  }
}

// 1️⃣ Get all operator activities
exports.getAllOperatorActivities = async (req, res) => {
  try {
    const activities = await OperatorActivity.findAll();
    res.json(activities);
  } catch (err) {
    console.error("Error fetching operator activities:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2️⃣ Get operator activity by activity_id and include business_name from rt_user
exports.getOperatorsByActivityId = async (req, res) => {
  const { activityId } = req.params;
  const activity_id = activityId;

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

    const result = operators.map((op) => ({
      ...op.dataValues,
      rt_user_id: op.rt_user ? op.rt_user.user_id : null,
      business_name: op.rt_user ? op.rt_user.business_name : "Not Provided",
      services_provided_list: parseJSONField(op.services_provided),
      available_dates_list: parseJSONField(op.available_dates),
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching operators with business names:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get single operator activity by operator ID
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

    res.json({
      ...operator.dataValues,
      business_name: operator.rt_user
        ? operator.rt_user.business_name
        : "Not Provided",
      services_provided_list: parseJSONField(operator.services_provided),
      available_dates_list: parseJSONField(operator.available_dates),
    });
  } catch (err) {
    console.error("Error fetching operator activity by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

// 3️⃣ Create a new operator activity
exports.createOperatorActivity = async (req, res) => {
  try {
    const { activity_id, rt_user_id, address } = req.body;

    // Validate required fields before DB insert
    if (!rt_user_id) {
      return res
        .status(400)
        .json({ error: "rt_user_id is required. Please login again." });
    }
    if (!activity_id) {
      return res.status(400).json({ error: "activity_id is required." });
    }

    const newActivity = await OperatorActivity.create({
      ...req.body,
      rt_user_id: parseInt(rt_user_id, 10),
      activity_id: parseInt(activity_id, 10),
      address: address || "",
    });
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
      "available_dates", // ✅ ADD THIS
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        activity[field] = req.body[field];
      }
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

// 6️⃣ Get all operator activities by user (includes activity_name from activity_master_table)
exports.getAllOperatorActivitiesByUser = async (req, res) => {
  const { rt_user_id } = req.params;

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

    const result = activities.map((activity) => ({
      ...activity.dataValues,
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
