const FormResp = require("../models/formModel"); // Import the User model
const { Op } = require("sequelize"); // Sequelize operators for querying

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

// Create a form/receipt
exports.createForm = async (req, res) => {
  try {
    const newForm = await FormResp.create(req.body);
    res.status(201).json(newForm);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Database query error." });
  }
};

//get form/receipt by user id
exports.getFormByUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const form = await FormResp.findAll({
      where: { operator_user_id: user_id },
    });

    if (!form) {
      return res.status(404).json({ error: "forms not found." });
    }

    res.json(form);
  } catch (err) {
    res.status(500).json({ error: "Database query error." });
  }
};
