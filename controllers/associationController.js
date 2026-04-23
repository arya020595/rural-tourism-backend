const associationService = require("../services/associationService");
const { serializeMany } = require("../serializers/associationSerializer");
const { successResponse, errorResponse } = require("../utils/helpers");

exports.getAll = async (req, res) => {
  try {
    const associations = await associationService.getAllAssociations();
    return successResponse(
      res,
      serializeMany(associations),
      "Associations retrieved successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};
