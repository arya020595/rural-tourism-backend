const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController'); // Import the controller
const Activity = require('../models/activityModel');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// 1. Route to get all activities
router.get('/', async (req, res) => {
    try {
        const activities = await activityController.getAllActivities();
        res.json(activities);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// 2. Route to get activity by activity_id
router.get('/:activity_id', async (req, res) => {
    const { activity_id } = req.params;
    try {
        const activity = await activityController.getActivityById(activity_id);
        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        res.json(activity);
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// 3. Route to create a new activity
// router.post('/', async (req, res) => {
//     const { activity_id, activity_name, location, user_id } = req.body;
    
//     if (!activity_id || !activity_name || !location || !user_id) {
//         return res.status(400).json({ error: 'Missing required fields' });
//     }
    
//     try {
//         const newActivity = await activityController.createActivity({ activity_id, activity_name, location, user_id });
//         res.status(201).json(newActivity);
//     } catch (error) {
//         console.error('Error creating activity:', error);
//         res.status(500).json({ error: 'Failed to create activity' });
//     }
// });

router.post('/', asyncHandler(activityController.createActivity));

// 4. Route to update an existing activity
router.put('/:activity_id', async (req, res) => {
    const { activity_id } = req.params;
    const { activity_name, location, user_id } = req.body;

    try {
        const updatedActivity = await activityController.updateActivity(activity_id, { activity_name, location, user_id });
        if (!updatedActivity) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        res.json(updatedActivity);
    } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).json({ error: 'Failed to update activity' });
    }
});

// 5. Route to delete an activity
router.delete('/:activity_id', async (req, res) => {
    const { activity_id } = req.params;

    try {
        const deletedActivity = await activityController.deleteActivity(activity_id);
        if (!deletedActivity) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        res.json({ message: 'Activity deleted successfully' });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

router.get('/user/:user_id', async (req, res) => {
    const { user_id } = req.params;  // Extract user_id from the request parameters

    try {
        // Find all accommodations associated with the user_id
        const activity = await Activity.findAll({ where: { user_id } });

        if (activity.length === 0) {
            return res.status(404).json({ error: 'No accommodations found for this user.' });
        }
        
        res.json(activity);  // Return the list of accommodations
    } catch (error) {
        console.error('Error fetching accommodations by user_id:', error);  // Log the error
        res.status(500).json({ error: error.message });  // Send back the error message
    }
});

module.exports = router;
