const associationService = require("../services/associationService");

exports.getAll = async (req, res) => {
    try {
        const associations = await associationService.getAllAssociations();
        res.json(associations);
    } catch (error) {
        res.status(500).json({ error: "Database query error." });
    }
};