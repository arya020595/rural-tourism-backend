const express = require('express');
const router = express.Router();
const accomController = require('../controllers/accomController');
const Accom = require('../models/accomModel');
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

//1. Route to get all accomodation
router.get('/', async (req, res) => {
    try {
        const accomodation = await Accom.findAll();
        res.json(accomodation);
    } catch (error) {
        console.error('Error fetching users:', error); // Log the full error
        res.status(500).json({ error: error.message }); // Send back the error message
    }
});

// 2. Route to get accommodation by homest_id (GET /:homest_id)
router.get('/:homest_id', async (req, res) => {
    const { homest_id } = req.params;  // Extract homest_id from the request parameters
    try {
        const accomodation = await Accom.findOne({ where: { homest_id } });

        if (!accomodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }

        res.json(accomodation);  // Return the found accommodation
    } catch (error) {
        console.error('Error fetching accommodation by ID:', error);  // Log the error
        res.status(500).json({ error: error.message });  // Send back the error message
    }
});

// 3. Route to create a new accommodation (POST /)
router.post('/', async (req, res) => {
    const { homest_id, homest_name, location, user_id } = req.body;

    // Validate the incoming data
    if (!homest_id || !homest_name || !location || !user_id) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const newAccomodation = await Accom.create({
            homest_id,
            homest_name,
            location,
            user_id
        });

        res.status(201).json(newAccomodation);  // 201 indicates a resource has been created
    } catch (error) {
        console.error('Error creating accommodation:', error);  // Log the error
        res.status(500).json({ error: error.message });  // Send back the error message
    }
});

// 4. Route to update an accommodation by homest_id (PUT /:homest_id)
router.put('/:homest_id', async (req, res) => {
    const { homest_id } = req.params;  // Extract homest_id from the URL parameter
    const { homest_name, location, user_id } = req.body;

    try {
        const accomodation = await Accom.findOne({ where: { homest_id } });

        if (!accomodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }

        // Update the accommodation with the provided fields
        accomodation.homest_name = homest_name || accomodation.homest_name;
        accomodation.location = location || accomodation.location;
        accomodation.user_id = user_id || accomodation.user_id;

        await accomodation.save();  // Save the updated accommodation

        res.json(accomodation);  // Return the updated accommodation
    } catch (error) {
        console.error('Error updating accommodation:', error);  // Log the error
        res.status(500).json({ error: error.message });  // Send back the error message
    }
});

// 5. Route to delete an accommodation by homest_id (DELETE /:homest_id)
router.delete('/:homest_id', async (req, res) => {
    const { homest_id } = req.params;  // Extract homest_id from the URL parameter

    try {
        const accomodation = await Accom.findOne({ where: { homest_id } });

        if (!accomodation) {
            return res.status(404).json({ error: 'Accommodation not found.' });
        }

        await accomodation.destroy();  // Delete the accommodation from the database

        res.json({ message: 'Accommodation deleted successfully.' });  // Success message
    } catch (error) {
        console.error('Error deleting accommodation:', error);  // Log the error
        res.status(500).json({ error: error.message });  // Send back the error message
    }
});


// 6. Route to fetch all accomodation based on User ID
router.get('/user/:user_id', async (req, res) => {
    const { user_id } = req.params;  // Extract user_id from the request parameters

    try {
        // Find all accommodations associated with the user_id
        const accommodations = await Accom.findAll({ where: { user_id } });

        if (accommodations.length === 0) {
            return res.status(404).json({ error: 'No accommodations found for this user.' });
        }

        res.json(accommodations);  // Return the list of accommodations
    } catch (error) {
        console.error('Error fetching accommodations by user_id:', error);  // Log the error
        res.status(500).json({ error: error.message });  // Send back the error message
    }
});



module.exports = router;