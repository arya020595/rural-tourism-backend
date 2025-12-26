const Accom = require('../models/accomModel'); // Import the accomodation model
const { Op } = require('sequelize'); // Sequelize operators for querying

//1. get all accomodations
exports.getAllAccom = async (req, res) => {
    try {
        const accomodation = await Accom.findAll();
        res.json(accomodation);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 2. Get accommodation by `homest_id` (Read one by primary key)
exports.getAccomById = async (req, res) => {
    const { homest_id } = req.params;  // Using homest_id as the identifier
    try {
        const accommodation = await Accom.findOne({ where: { homest_id } });
        
        if (!accommodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }
        
        res.json(accommodation);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 3. Create a new accommodation (Create)
exports.createAccom = async (req, res) => {
    const { homest_id, homest_name, location, user_id } = req.body;

    if (!homest_id || !homest_name || !location || !user_id) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const newAccommodation = await Accom.create({
            homest_id,
            homest_name,
            location,
            user_id,
        });

        res.status(201).json(newAccommodation);  // 201 indicates resource creation
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 4. Update an existing accommodation (Update)
exports.updateAccom = async (req, res) => {
    const { homest_id } = req.params;  // Using homest_id to identify the record to update
    const { homest_name, location, user_id } = req.body;

    try {
        const accommodation = await Accom.findOne({ where: { homest_id } });

        if (!accommodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }

        // Update only the fields provided in the request body
        accommodation.homest_name = homest_name || accommodation.homest_name;
        accommodation.location = location || accommodation.location;
        accommodation.user_id = user_id || accommodation.user_id;

        await accommodation.save();  // Save the updated accommodation to the database
        res.json(accommodation);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// 5. Delete an accommodation (Delete)
exports.deleteAccom = async (req, res) => {
    const { homest_id } = req.params;  // Using homest_id to identify the accommodation to delete

    try {
        const accommodation = await Accom.findOne({ where: { homest_id } });

        if (!accommodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }

        await accommodation.destroy();  // Delete the accommodation from the database
        res.json({ message: 'Accommodation deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }

};

// 6. Get all accommodation by `user_id` (Read one by primary key)
exports.getAccomByUser = async (req, res) => {
    const { user_id } = req.params;  // Using homest_id as the identifier
    try {
        const accommodation = await Accom.findAll({ where: { user_id } });
        
        if (!accommodation) {
            
            
            return res.status(404).json({ error: 'Accommodation not found.' });
        }
        
        res.json(accommodation);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

