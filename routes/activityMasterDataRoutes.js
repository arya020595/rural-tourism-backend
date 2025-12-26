const express = require('express');
const router = express.Router();
const ActivityMasterData = require('../models/activityMasterDataModel');

// ✅ 1. Get all activities
router.get('/', async (req, res) => {
  try {
    const activities = await ActivityMasterData.findAll();
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 2. Get a single activity by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const activity = await ActivityMasterData.findByPk(id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 3. Create a new activity
router.post('/', async (req, res) => {
  const { activity_name, description, address, things_to_know, image } = req.body;

  try {
    const newActivity = await ActivityMasterData.create({
      activity_name,
      description,
      address,
      things_to_know,
      image
    });

    res.status(201).json(newActivity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 4. Update an existing activity
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { activity_name, description, address, things_to_know, image } = req.body;

  try {
    const activity = await ActivityMasterData.findByPk(id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    await activity.update({
      activity_name,
      description,
      address,
      things_to_know,
      image
    });

    res.json(activity);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 5. Delete an activity
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const activity = await ActivityMasterData.findByPk(id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    await activity.destroy();
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
