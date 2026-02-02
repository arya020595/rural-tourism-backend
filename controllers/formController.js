// controllers/formController.js
const FormResp = require("../models/formModel"); // form_responses
const TouristUser = require("../models/touristModel"); // tourists

/**
 * Create a new form entry
 */
exports.createForm = async (req, res) => {
  try {
    let {
      receipt_id,
      tourist_user_id,
      citizenship,
      pax,
      pax_domestik,
      pax_antarabangsa,
      activity_name,
      homest_name,
      location,
      activity_id,
      homest_id,
      total_rm,
      total_night,
      issuer,
      date,
      activity_booking_id,
      accommodation_booking_id,
    } = req.body;

    // Trim IDs to remove extra spaces
    tourist_user_id = tourist_user_id?.trim();
    activity_id = activity_id?.trim();

    // Validate required fields
    if (!tourist_user_id || !citizenship || !pax) {
      return res.status(400).json({
        success: false,
        message: "tourist_user_id, citizenship, and pax are required.",
      });
    }

    // Validate tourist exists
    const tourist = await TouristUser.findByPk(tourist_user_id);
    if (!tourist) {
      return res.status(400).json({
        success: false,
        message:
          "Tourist not found. Make sure the ID exists and matches exactly.",
      });
    }

    // Generate receipt_id if not provided
    receipt_id =
      receipt_id ||
      `PE${Math.floor(Math.random() * 10000000)
        .toString()
        .padStart(7, "0")}`;

    // Prepare numeric fields safely
    pax = Number(pax);
    pax_domestik = Number(pax_domestik || 0);
    pax_antarabangsa = Number(pax_antarabangsa || 0);
    homest_id = homest_id ? Number(homest_id) : null;
    activity_id = activity_id || null;
    total_rm = total_rm != null ? total_rm.toString() : null;

    // Create form
    const newForm = await FormResp.create({
      receipt_id,
      tourist_user_id,
      citizenship,
      pax,
      pax_domestik,
      pax_antarabangsa,
      activity_name: activity_name || null,
      homest_name: homest_name || null,
      location: location || null,
      activity_id,
      homest_id,
      total_rm,
      total_night: total_night || null,
      issuer: issuer || null,
      date: date || null,
      operator_user_id: req.body.operator_user_id || "Unknown Operator",
      activity_booking_id: activity_booking_id || null,
      accommodation_booking_id: accommodation_booking_id || null,
    });

    return res.status(201).json({ success: true, data: newForm });
  } catch (err) {
    console.error("Error creating form:", err);

    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        success: false,
        message:
          "Foreign key constraint failed. Check tourist_user_id and activity_id exist in the database.",
      });
    }

    return res.status(500).json({ error: "Database query error." });
  }
};

/**
 * Get a form by receipt_id
 */
exports.getRespById = async (req, res) => {
  try {
    const { id } = req.params;

    const form = await FormResp.findOne({
      where: { receipt_id: id },
      include: [
        {
          model: TouristUser,
          as: "tourist", // Must match alias in formModel
          attributes: ["tourist_user_id", "full_name", "email", "contact_no"],
        },
      ],
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found with that receipt_id.",
      });
    }

    res.status(200).json({ success: true, data: form });
  } catch (err) {
    console.error("Error fetching form by ID:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error. Could not fetch form.",
    });
  }
};

/**
 * Get all forms created by a specific operator
 */
exports.getFormsByOperator = async (req, res) => {
  try {
    const { user_id } = req.params;

    const forms = await FormResp.findAll({
      where: { operator_user_id: user_id },
      include: [
        {
          model: TouristUser,
          as: "tourist",
          attributes: ["tourist_user_id", "full_name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({ success: true, data: forms });
  } catch (err) {
    console.error("Error fetching forms by operator:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error. Could not fetch forms.",
    });
  }
};
