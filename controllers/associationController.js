const Association = require('../models/associationModel');
exports.getAll = async (req, res) => {
    try {
        const associations = await Association.findAll();
        res.json(associations);
    } catch (error) {
        res.status(500).json({ error: 'Database query error.' });
    }
}