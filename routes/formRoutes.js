const express = require("express");
const router = express.Router();
const formController = require("../controllers/formController");
const FormResp = require("../models/formModel");

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Route to get a form/receipt by ID
router.get("/:id", asyncHandler(formController.getRespById));

// Route to create a form
router.post("/", asyncHandler(formController.createForm));

//get all form according to user ID
router.get("/trans/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    // Find all forms associated with the operator_user_id
    const forms = await FormResp.findAll({
      where: { operator_user_id: user_id },
    });

    if (forms.length === 0) {
      return res.status(404).json({ error: "No forms found for this user." });
    }

    res.json(forms);
  } catch (error) {
    console.error("Error fetching forms by user_id:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
