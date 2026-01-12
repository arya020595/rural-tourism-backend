const FormResp = require("../models/formModel"); // Import the User model

//get form/receipt by id
exports.getRespById = async (req, res) => {
  try {
    const formResp = await FormResp.findByPk(req.params.id);
    if (!formResp) {
      return res.status(404).json({ message: "Form not found." });
    }
    res.json(formResp);
  } catch (err) {
    res.status(500).json({ error: "Database query error." });
  }
};

exports.createForm = async (req, res) => {
  try {
    const {
      operator_user_id,
      tourist_user_id,
      no_of_pax,
      date,
      contact_name,
      contact_phone,
      nationality,
      total_price,
      booking_id,
    } = req.body;

    // Validate required fields
    if (!operator_user_id || !tourist_user_id) {
      return res.status(400).json({
        success: false,
        message: "Operator ID and Tourist ID are required",
      });
    }

    // Create form/receipt
    const newForm = await FormResp.create({
      operator_user_id,
      tourist_user_id,
      no_of_pax,
      date,
      contact_name,
      contact_phone,
      nationality,
      total_price,
      booking_id,
    });

    res.status(201).json({
      success: true,
      message: "Form created successfully",
      data: newForm,
    });
  } catch (err) {
    console.error("Error creating form:", err);
    res.status(500).json({ error: "Database query error." });
  }
};
