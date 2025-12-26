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
  res.json(accommodations);
}));

/**
 * 2. Get all accommodations for a specific user
 * Place BEFORE the '/:id' route to avoid route conflicts
 */
router.get('/user/:user_id', asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const accommodations = await Accom.findAll({ where: { user_id } });

  if (accommodations.length === 0) {
    return res.status(404).json({ error: 'No accommodations found for this user.' });
  }

  res.json(accommodations);
}));

/**
 * 3. Get a single accommodation by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const accommodation = await Accom.findOne({ where: { id } });

  if (!accommodation) {
    return res.status(404).json({ error: 'Accommodation not found.' });
  }

  res.json(accommodation);
}));

/**
 * 4. Create a new accommodation
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, location, description, price, image, address, provided_accomodation, user_id, district, showAvailability } = req.body;

  if (!name || !location || !user_id) {
    return res.status(400).json({ error: 'name, location, and user_id are required.' });
  }

  const newAccommodation = await Accom.create({
    name,
    location,
    description,
    price,
    image,
    address,
    provided_accomodation,
    user_id,
    district,
    showAvailability
  });

  res.status(201).json(newAccommodation);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  console.log('Requested ID:', id);

  const accommodation = await Accom.findOne({ where: { id } });
  console.log('SQL result:', accommodation);

  if (!accommodation) {
    return res.status(404).json({ error: `Accommodation with ID ${id} not found.` });
  }

  res.json(accommodation);
}));



/**
 * 5. Update an accommodation by ID
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, location, description, price, image, address, provided_accomodation, user_id, district, showAvailability } = req.body;

  const accommodation = await Accom.findOne({ where: { id } });
  if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

  // Update only provided fields
  accommodation.name = name || accommodation.name;
  accommodation.location = location || accommodation.location;
  accommodation.description = description || accommodation.description;
  accommodation.price = price || accommodation.price;
  accommodation.image = image || accommodation.image;
  accommodation.address = address || accommodation.address;
  accommodation.provided_accomodation = provided_accomodation || accommodation.provided_accomodation;
  accommodation.user_id = user_id || accommodation.user_id;
  accommodation.district = district || accommodation.district;
  if (showAvailability !== undefined) accommodation.showAvailability = showAvailability;

  await accommodation.save();
  res.json(accommodation);
}));

/**
 * 6. Delete an accommodation by ID
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const accommodation = await Accom.findOne({ where: { id } });
  if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

  await accommodation.destroy();
  res.json({ message: 'Accommodation deleted successfully.' });
}));

module.exports = router;
