const ActivityMaster = require('../models/activityMasterModel'); // your Sequelize model

// 1️⃣ Get all activities
exports.getAllActivities = async (req, res) => {
    try {
        const activities = await ActivityMaster.findAll();
        res.json(activities);
    } catch (err) {
        console.error('Error fetching activities:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2️⃣ Get activity by ID
exports.getActivityById = async (req, res) => {
    const { id } = req.params;
    try {
        const activity = await ActivityMaster.findOne({ where: { id } });

        if (!activity) return res.status(404).json({ error: 'Activity not found.' });

        // Ensure things_to_know is always an array of {title, description}
        if (activity.things_to_know) {
            try {
                let parsed = typeof activity.things_to_know === 'string'
                    ? JSON.parse(activity.things_to_know)
                    : activity.things_to_know;

                if (Array.isArray(parsed)) {
                    activity.things_to_know = parsed;
                } else if (typeof parsed === 'object') {
                    // Convert object keys to array
                    activity.things_to_know = Object.entries(parsed).map(([key, value]) => ({
                        title: key.replace(/_/g, ' '), // optional formatting
                        description: value
                    }));
                } else {
                    activity.things_to_know = [];
                }
            } catch (parseError) {
                console.error('Error parsing things_to_know JSON:', parseError);
                activity.things_to_know = [];
            }
        } else {
            activity.things_to_know = [];
        }

        res.json(activity);
    } catch (err) {
        console.error('Error fetching activity by ID:', err);
        res.status(500).json({ error: err.message });
    }
};


// 3️⃣ Create activity
exports.createActivity = async (req, res) => {
    try {
        const newActivity = await ActivityMaster.create(req.body);
        res.status(201).json(newActivity);
    } catch (err) {
        console.error('Error creating activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4️⃣ Update activity
exports.updateActivity = async (req, res) => {
    const { id } = req.params;
    try {
        const activity = await ActivityMaster.findOne({ where: { id } });
        if (!activity) return res.status(404).json({ error: 'Activity not found.' });

        // Update only provided fields
        const fields = ['activity_name', 'description', 'address', 'things_to_know', 'image'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) activity[f] = req.body[f];
        });

        await activity.save();
        res.json(activity);
    } catch (err) {
        console.error('Error updating activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 5️⃣ Delete activity
exports.deleteActivity = async (req, res) => {
    const { id } = req.params;
    try {
        const activity = await ActivityMaster.findOne({ where: { id } });
        if (!activity) return res.status(404).json({ error: 'Activity not found.' });

        await activity.destroy();
        res.json({ message: 'Activity deleted successfully.' });
    } catch (err) {
        console.error('Error deleting activity:', err);
        res.status(500).json({ error: err.message });
    }
};
