const registrationService = require("../services/registrationService");
const { serialize, serializeMany } = require("../serializers/registrationSerializer");
const { policy } = require("../policies");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const { ForbiddenError } = require("../services/errors/AppError");

/** Loads the registration and checks it belongs to the approver's association. */
async function loadAuthorized(req) {
  const entry = await registrationService.getRegistration(req.params.companyId);
  if (!policy("registration", req.user, entry).decide()) {
    throw new ForbiddenError("This registration belongs to another association.");
  }
  return entry;
}

// GET /api/registrations
exports.list = async (req, res) => {
  try {
    const result = await registrationService.list(req.query, req.user);
    return paginatedResponse(
      res,
      serializeMany(result.rows),
      "Registrations fetched successfully",
      result.pagination,
      { counts: result.counts },
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/registrations/pending-count
exports.pendingCount = async (req, res) => {
  try {
    const pending = await registrationService.pendingCount(req.user);
    return successResponse(res, { pending }, "Pending registrations counted");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/registrations/:companyId
exports.show = async (req, res) => {
  try {
    const entry = await loadAuthorized(req);
    return successResponse(res, serialize(entry), "Registration fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// POST /api/registrations/:companyId/approve
exports.approve = async (req, res) => {
  try {
    await loadAuthorized(req);
    const entry = await registrationService.approve(req.params.companyId, req.user);
    return successResponse(res, serialize(entry), "Registration approved");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// POST /api/registrations/:companyId/reject  { reason }
exports.reject = async (req, res) => {
  try {
    await loadAuthorized(req);
    const entry = await registrationService.reject(req.params.companyId, req.body?.reason, req.user);
    return successResponse(res, serialize(entry), "Registration rejected");
  } catch (error) {
    return errorResponse(res, error);
  }
};
