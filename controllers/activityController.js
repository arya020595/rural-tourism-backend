const Activity = require('../models/activityModel');  // Import the Activity model

// 1. Get all activities (Read all)
exports.getAllActivities = async (req, res) => {
    try {
        const activities = await Activity.findAll();
        res.json(activities);
    } catch (err) {
        console.error('Error fetching activities:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2. Get activity by activity_id (Read one by primary key)
// exports.getActivityById = async (req, res) => {
//     const { activity_id } = req.params;
//     try {
//         const activity = await Activity.findOne({ where: { activity_id } });

//         if (!activity) {
//             return res.status(404).json({ error: 'Activity not found.' });
//         }

//         res.json(activity);
//     } catch (err) {
//         console.error('Error fetching activity by ID:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

exports.getActivityById = async (req, res) => {
  const { activity_id } = req.params;
  try {
    const activity = await Activity.findOne({ where: { activity_id } });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found.' });
    }
    // Parse things_to_know JSON string into an object/array if it exists
    if (activity.things_to_know) {
      try {
        activity.things_to_know = JSON.parse(activity.things_to_know);
      } catch (parseError) {
        console.error('Error parsing things_to_know JSON:', parseError);
        // You can decide what to do here — maybe set it to an empty array?
        activity.things_to_know = [];
      }
    }
    res.json(activity);
  } catch (err) {
    console.error('Error fetching activity by ID:', err);
    res.status(500).json({ error: err.message });
  }
};

// 3. Create a new activity (Create)
exports.createActivity = async (req, res) => {
   
    // console.log('req body activity:' , req.body);

    try {
        const newActivity = await Activity.create(req.body);
        res.status(201).json(newActivity);  // 201 indicates resource creation
    } catch (err) {
        console.error('Error creating activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4. Update an existing activity (Update)
exports.updateActivity = async (req, res) => {
    const { activity_id } = req.params;
    const { activity_name, location, user_id } = req.body;

    try {
        const activity = await Activity.findOne({ where: { activity_id } });

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found.' });
        }

        // Update fields only if provided
        activity.activity_name = activity_name || activity.activity_name;
        activity.location = location || activity.location;
        activity.user_id = user_id || activity.user_id;

        await activity.save();  // Save the updated activity

        res.json(activity);
    } catch (err) {
        console.error('Error updating activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 5. Delete an activity (Delete)
exports.deleteActivity = async (req, res) => {
    const { activity_id } = req.params;

    try {
        const activity = await Activity.findOne({ where: { activity_id } });

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found.' });
        }

        await activity.destroy();  // Delete the activity from the database

        res.json({ message: 'Activity deleted successfully.' });
    } catch (err) {
        console.error('Error deleting activity:', err);
        res.status(500).json({ error: err.message });
    }
};


// 6. Get all activity by user_id 
exports.getAllActivityByUser = async (req, res) => {
    const { user_id } = req.params;
    try {
        const activity = await Activity.findAll({ where: { user_id } });

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found.' });
        }

        res.json(activity);
    } catch (err) {
        console.error('Error fetching activity by ID:', err);
        res.status(500).json({ error: err.message });
    }
};
