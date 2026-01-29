const Accom = require("../models/accomModel");
const accommodationService = require("../services/accommodationService");

/**
 * Accommodation Controller
 * Handles HTTP requests for accommodation-related endpoints
 * Delegates business logic to accommodationService
 */

/**
 * Get all accommodations with booking-aware filtering
 * @route GET /api/accom
 * @query {string} date - Single date filter (YYYY-MM-DD)
 * @query {string} startDate - Start date for range filter
 * @query {string} endDate - End date for range filter
 */
exports.getAllAccommodations = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;

    const accommodations = await Accom.findAll();

    // Apply booking-aware filtering via service
    const filteredAccommodations =
      await accommodationService.applyBookingAwareFiltering(accommodations, {
        date,
        startDate,
        endDate,
      });

    // Format response for frontend
    const result = filteredAccommodations.map((accom) => ({
      ...accom,
      user_id: accom.rt_user_id,
      homest_id: accom.accommodation_id,
      homest_name: accom.name,
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching accommodations:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get accommodations for a specific user
 * @route GET /api/accom/user/:user_id
 * @param {string} user_id - User ID
 */
exports.getAccommodationsByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    const accommodations = await Accom.findAll({
      where: { rt_user_id: user_id },
    });

    if (accommodations.length === 0) {
      return res
        .status(404)
        .json({ error: "No accommodations found for this user." });
    }

    // Format response
    const result = accommodations.map((accom) => ({
      ...accom.dataValues,
      user_id: accom.rt_user_id,
      homest_id: accom.accommodation_id,
      homest_name: accom.name,
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching accommodations by user:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get single accommodation by ID
 * @route GET /api/accom/:id
 * @param {string} id - Accommodation ID
 * @query {string} date - Optional single date filter (YYYY-MM-DD)
 * @query {string} startDate - Optional start of date range (YYYY-MM-DD)
 * @query {string} endDate - Optional end of date range (YYYY-MM-DD)
 */
exports.getAccommodationById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID." });
    }

    const accommodation = await Accom.findByPk(id);

    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found." });
    }

    // Apply booking-aware filtering (including date filters if provided)
    const filters = {
      date: req.query.date,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const [filtered] = await accommodationService.applyBookingAwareFiltering(
      [accommodation],
      filters,
    );

    // If filtered out (no available dates match), return empty result
    if (!filtered) {
      return res.status(404).json({
        error: "Accommodation not available for the specified dates",
      });
    }

    res.json({
      ...filtered,
      user_id: filtered.rt_user_id,
      homest_id: filtered.accommodation_id,
      homest_name: filtered.name,
    });
  } catch (err) {
    console.error("Error fetching accommodation by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create a new accommodation
 * @route POST /api/accom
 * @body {object} accommodation - Accommodation data
 */
exports.createAccommodation = async (req, res) => {
  try {
    const {
      name,
      homest_name,
      location,
      description,
      price,
      image,
      address,
      provided,
      provided_accomodation,
      rt_user_id,
      user_id,
      district,
      show_availability,
      showAvailability,
      available_dates,
    } = req.body;

    // Use frontend aliases if main fields are not provided
    const finalName = name || homest_name;
    const finalUserId = rt_user_id || user_id;
    const finalProvided = provided || provided_accomodation;
    const finalShowAvailability =
      show_availability !== undefined ? show_availability : showAvailability;

    if (!finalName || !finalUserId) {
      return res
        .status(400)
        .json({ error: "Name and user ID are required fields." });
    }

    const newAccommodation = await Accom.create({
      name: finalName,
      rt_user_id: finalUserId,
      description: description || "",
      price: price || null,
      image: image || null,
      district: district || "",
      provided: finalProvided || "",
      address: address || location || "",
      location: location || "",
      show_availability: finalShowAvailability || false,
      available_dates: available_dates || [],
    });

    res.status(201).json({
      ...newAccommodation.dataValues,
      user_id: newAccommodation.rt_user_id,
      homest_id: newAccommodation.accommodation_id,
      homest_name: newAccommodation.name,
    });
  } catch (err) {
    console.error("Error creating accommodation:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update an accommodation
 * @route PUT /api/accom/:id
 * @param {string} id - Accommodation ID
 * @body {object} updates - Accommodation updates
 */
exports.updateAccommodation = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID." });
    }

    const accommodation = await Accom.findByPk(id);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found." });
    }

    const {
      name,
      homest_name,
      location,
      description,
      price,
      image,
      address,
      provided,
      provided_accomodation,
      rt_user_id,
      user_id,
      district,
      show_availability,
      showAvailability,
      available_dates,
    } = req.body;

    // Update fields
    if (name !== undefined) accommodation.name = name;
    if (homest_name !== undefined) accommodation.name = homest_name;
    if (description !== undefined) accommodation.description = description;
    if (price !== undefined) accommodation.price = price;
    if (image !== undefined) accommodation.image = image;
    if (district !== undefined) accommodation.district = district;
    if (provided !== undefined) accommodation.provided = provided;
    if (provided_accomodation !== undefined)
      accommodation.provided = provided_accomodation;
    if (address !== undefined) accommodation.address = address;
    if (location !== undefined) {
      accommodation.address = location;
      accommodation.location = location;
    }
    if (rt_user_id !== undefined) accommodation.rt_user_id = rt_user_id;
    if (user_id !== undefined) accommodation.rt_user_id = user_id;
    if (show_availability !== undefined)
      accommodation.show_availability = show_availability;
    if (showAvailability !== undefined)
      accommodation.show_availability = showAvailability;
    if (available_dates !== undefined)
      accommodation.available_dates = available_dates;

    await accommodation.save();

    res.json({
      ...accommodation.dataValues,
      user_id: accommodation.rt_user_id,
      homest_id: accommodation.accommodation_id,
      homest_name: accommodation.name,
    });
  } catch (err) {
    console.error("Error updating accommodation:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete an accommodation
 * @route DELETE /api/accom/:id
 * @param {string} id - Accommodation ID
 */
exports.deleteAccommodation = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID." });
    }

    const accommodation = await Accom.findByPk(id);
    if (!accommodation) {
      return res.status(404).json({ error: "Accommodation not found." });
    }

    await accommodation.destroy();
    res.json({ message: "Accommodation deleted successfully." });
  } catch (err) {
    console.error("Error deleting accommodation:", err);
    res.status(500).json({ error: err.message });
  }
};
