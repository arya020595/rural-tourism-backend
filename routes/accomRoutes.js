const express = require('express');
const router = express.Router();
const Accom = require('../models/accomModel');

// Helper for async error handling
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 1. Get all accommodations
 */
router.get('/', asyncHandler(async (req, res) => {
  const accommodations = await Accom.findAll();
  
  // Map to include frontend aliases
  const result = accommodations.map(accom => ({
    ...accom.dataValues,
    user_id: accom.rt_user_id,
    homest_id: accom.accommodation_id,
    homest_name: accom.name
  }));
  
  res.json(result);
}));

/**
 * 2. Get all accommodations for a specific user
 * Frontend sends: user_id
 * Backend uses: rt_user_id
 */
router.get('/user/:user_id', asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const accommodations = await Accom.findAll({ where: { rt_user_id: user_id } });

  if (accommodations.length === 0) {
    return res.status(404).json({ error: 'No accommodations found for this user.' });
  }

  // Map to include frontend aliases
  const result = accommodations.map(accom => ({
    ...accom.dataValues,
    user_id: accom.rt_user_id,
    homest_id: accom.accommodation_id,
    homest_name: accom.name
  }));

  res.json(result);
}));

/**
 * 3. Get a single accommodation by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const accommodation = await Accom.findByPk(id);

  if (!accommodation) {
    return res.status(404).json({ error: 'Accommodation not found.' });
  }

  res.json({
    ...accommodation.dataValues,
    user_id: accommodation.rt_user_id,
    homest_id: accommodation.accommodation_id,
    homest_name: accommodation.name
  });
}));

/**
 * 4. Create a new accommodation
 * Frontend sends: homest_id, homest_name, location, user_id
 * Backend maps to: name, location, rt_user_id
 */
router.post('/', asyncHandler(async (req, res) => {
  const { 
    name, 
    homest_name, // Frontend alias
    location, 
    description, 
    price, 
    image, 
    address, 
    provided, 
    provided_accomodation, // Frontend alias
    rt_user_id,
    user_id, // Frontend alias
    district, 
    show_availability,
    showAvailability // Frontend alias
  } = req.body;

  // Use frontend aliases if main fields are not provided
  const finalName = name || homest_name;
  const finalUserId = rt_user_id || user_id;
  const finalProvided = provided || provided_accomodation;
  const finalShowAvailability = show_availability !== undefined ? show_availability : showAvailability;

  if (!finalName || !finalUserId) {
    return res.status(400).json({ error: 'name (or homest_name) and user_id are required.' });
  }

  const newAccommodation = await Accom.create({
    name: finalName,
    location,
    description,
    price,
    image,
    address,
    provided: finalProvided,
    rt_user_id: finalUserId,
    district,
    show_availability: finalShowAvailability
  });

  // Return with frontend aliases
  res.status(201).json({
    ...newAccommodation.dataValues,
    user_id: newAccommodation.rt_user_id,
    homest_id: newAccommodation.accommodation_id,
    homest_name: newAccommodation.name
  });
}));

/**
 * 5. Update an accommodation by ID
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

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
    showAvailability
  } = req.body;

  const accommodation = await Accom.findByPk(id);
  if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

  // Update only provided fields (accept both original and alias names)
  if (name !== undefined) accommodation.name = name;
  if (homest_name !== undefined) accommodation.name = homest_name;
  if (location !== undefined) accommodation.location = location;
  if (description !== undefined) accommodation.description = description;
  if (price !== undefined) accommodation.price = price;
  if (image !== undefined) accommodation.image = image;
  if (address !== undefined) accommodation.address = address;
  if (provided !== undefined) accommodation.provided = provided;
  if (provided_accomodation !== undefined) accommodation.provided = provided_accomodation;
  if (rt_user_id !== undefined) accommodation.rt_user_id = rt_user_id;
  if (user_id !== undefined) accommodation.rt_user_id = user_id;
  if (district !== undefined) accommodation.district = district;
  if (show_availability !== undefined) accommodation.show_availability = show_availability;
  if (showAvailability !== undefined) accommodation.show_availability = showAvailability;

  await accommodation.save();
  
  res.json({
    ...accommodation.dataValues,
    user_id: accommodation.rt_user_id,
    homest_id: accommodation.accommodation_id,
    homest_name: accommodation.name
  });
}));

/**
 * 6. Delete an accommodation by ID
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const accommodation = await Accom.findByPk(id);
  if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

  await accommodation.destroy();
  res.json({ message: 'Accommodation deleted successfully.' });
}));

module.exports = router;
