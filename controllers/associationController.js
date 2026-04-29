const associationService = require("../services/associationService");
const {
  serializeMany,
  serializeAuthorized,
} = require("../serializers/associationSerializer");
const { successResponse, errorResponse } = require("../utils/helpers");
const { policy } = require("../policies");
const { ForbiddenError } = require("../services/errors/AppError");

exports.getPublicList = async (req, res) => {
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

exports.getMyAssociation = async (req, res) => {
  try {
    const association = await associationService.getScopedAssociation(
      req.user?.association_id,
    );
    if (!policy("association", req.user, association).show()) {
      throw new ForbiddenError("Not authorized to view this association");
    }

    return successResponse(
      res,
      serializeAuthorized(association),
      "Association retrieved successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};
