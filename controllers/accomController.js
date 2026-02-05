const Accom = require("../models/accomModel"); // Import the accommodation model

// 1. Get all accommodations
exports.getAllAccom = async (req, res) => {
  try {
    const accommodations = await Accom.findAll();
    res.json(accommodations);
  } catch (err) {
    res.status(500).json({ error: "Database query error." });
  }
};

// 2. Get accommodation by ID
exports.getAccomById = async (req, res) => {
  const { id } = req.params;
  try {
    const accommodation = await Accom.findByPk(id);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found." });
    }
    res.json(accommodation);
  } catch (err) {
    console.error("Error fetching accommodation:", err);
    res.status(500).json({ error: "Database query error." });
  }
};

// 3. Create a new accommodation
// 3. Create a new accommodation
exports.createAccom = async (req, res) => {
  let {
    name,
    location,
    description,
    price,
    image,
    address,
    provided,
    rt_user_id,
    district,
    show_availability,
    available_dates,
  } = req.body;

  if (!name || !rt_user_id) {
    return res.status(400).json({ error: "name and rt_user_id are required." });
  }

  // --- Ensure available_dates is always an array ---
  if (!available_dates) {
    available_dates = [];
  } else if (typeof available_dates === "string") {
    try {
      available_dates = JSON.parse(available_dates);
      if (!Array.isArray(available_dates)) available_dates = [];
    } catch {
      available_dates = [];
    }
  } else if (!Array.isArray(available_dates)) {
    available_dates = [];
  }

  try {
    const newAccommodation = await Accom.create({
      name,
      location,
      description,
      price,
      image,
      address,
      provided,
      rt_user_id,
      district,
      show_availability: show_availability ? 1 : 0,
      available_dates,
    });

    res.status(201).json(newAccommodation);
  } catch (err) {
    console.error("Error creating accommodation:", err);
    res.status(500).json({ error: "Database query error." });
  }
};

// 4. Update an accommodation by ID
exports.updateAccom = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    location,
    description,
    price,
    image,
    address,
    provided,
    rt_user_id,
    district,
    show_availability,
    available_dates,
  } = req.body;

  try {
    const accommodation = await Accom.findByPk(id);
    if (!accommodation)
      return res.status(404).json({ error: "Accommodation not found." });

    // Update only provided fields
    if (name !== undefined) accommodation.name = name;
    if (location !== undefined) accommodation.location = location;
    if (description !== undefined) accommodation.description = description;
    if (price !== undefined) accommodation.price = price;
    if (image !== undefined) accommodation.image = image;
    if (address !== undefined) accommodation.address = address;
    if (provided !== undefined) accommodation.provided = provided;
    if (rt_user_id !== undefined) accommodation.rt_user_id = rt_user_id;
    if (district !== undefined) accommodation.district = district;
    if (show_availability !== undefined)
      accommodation.show_availability = show_availability;
    if (available_dates !== undefined)
      accommodation.available_dates = available_dates;

    await accommodation.save();
    res.json(accommodation);
  } catch (err) {
    console.error("Error updating accommodation:", err);
    res.status(500).json({ error: "Database query error." });
  }
};

// 5. Delete an accommodation by ID
exports.deleteAccom = async (req, res) => {
  const { id } = req.params;

  try {
    const accommodation = await Accom.findByPk(id);
    if (!accommodation)
      return res.status(404).json({ error: "Accommodation not found." });

    await accommodation.destroy();
    res.json({ message: "Accommodation deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Database query error." });
  }
};

// 6. Get all accommodations by user ID
exports.getAccomByUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const accommodations = await Accom.findAll({
      where: { rt_user_id: user_id },
    });
    if (accommodations.length === 0) {
      return res
        .status(404)
        .json({ error: "No accommodations found for this user." });
    }
    res.json(accommodations);
  } catch (err) {
    res.status(500).json({ error: "Database query error." });
  }
};
