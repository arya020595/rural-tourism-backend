const Accom = require('../models/accomModel'); // Import the accommodation model

// 1. Get all accommodations
exports.getAllAccom = async (req, res) => {
    try {
        const accommodations = await Accom.findAll();
        res.json(accommodations);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 2. Get accommodation by ID
exports.getAccomById = async (req, res) => {
    const { id } = req.params; // Use 'id', matching your model
    try {
        const accommodation = await Accom.findOne({ where: { id } });
        if (!accommodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }
        res.json(accommodation);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 3. Create a new accommodation
exports.createAccom = async (req, res) => {
    const { name, location, description, price, image, address, provided_accomodation, user_id, district, showAvailability } = req.body;

    if (!name || !location || !user_id) {
        return res.status(400).json({ error: 'name, location, and user_id are required.' });
    }

    try {
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

        res.status(201).json(newAccommodation); // 201 = created
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 4. Update an accommodation by ID
exports.updateAccom = async (req, res) => {
    const { id } = req.params; // Use 'id'
    const { name, location, description, price, image, address, provided_accomodation, user_id, district, showAvailability } = req.body;

    try {
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
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 5. Delete an accommodation by ID
exports.deleteAccom = async (req, res) => {
    const { id } = req.params; // Use 'id'

    try {
        const accommodation = await Accom.findOne({ where: { id } });
        if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

        await accommodation.destroy();
        res.json({ message: 'Accommodation deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 6. Get all accommodations by user ID
exports.getAccomByUser = async (req, res) => {
    const { user_id } = req.params;

    try {
        const accommodations = await Accom.findAll({ where: { user_id } });
        if (accommodations.length === 0) {
            return res.status(404).json({ error: 'No accommodations found for this user.' });
        }
        res.json(accommodations);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};
