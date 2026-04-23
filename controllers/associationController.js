const associationService = require("../services/associationService");
const {
  serializeMany,
  serializeAuthorized,
} = require("../serializers/associationSerializer");
const { successResponse, errorResponse } = require("../utils/helpers");
const {
  ForbiddenError,
  NotFoundError,
} = require("../services/errors/AppError");

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
    const associationId = req.user?.association_id;

    if (!associationId) {
      throw new ForbiddenError("Association scope is required");
    }

    const association = await associationService.getAssociationById(associationId);

    if (!association) {
      throw new NotFoundError("Association not found");
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
