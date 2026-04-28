const userService = require("../services/userService");
const { policy, policyScope } = require("../policies");
const { serialize, serializeMany } = require("../serializers/userSerializer");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const {
  ForbiddenError,
  BadRequestError,
} = require("../services/errors/AppError");

/* ── Controller actions ────────────────────────────────────────── */

// GET /api/users — policy-scoped list with search, filter, sort, pagination
exports.getAllUsers = async (req, res) => {
  try {
    const scope = policyScope("user", req.user);
    const { where, order } = req.ransack;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page || req.query.limit) || 10;

    const result = await userService.getAllUsers(scope, {
      where,
      order,
      search: req.query.search,
      page,
      perPage,
    });

    return paginatedResponse(
      res,
      serializeMany(result.docs),
      "Users fetched successfully",
      { total: result.total, page, perPage, pages: result.pages },
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// GET /api/users/:id — policy-authorized
exports.getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!policy("user", req.user, user).show()) {
      throw new ForbiddenError(
        "You can only access users within your own company.",
      );
    }

    return successResponse(res, serialize(user), "User fetched successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// POST /api/users — create (authenticated)
exports.createUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    let { role_id, association_id, company_id } = req.body;

    const userPolicy = policy("user", req.user);
    if (!userPolicy.isAdmin()) {
      // Non-admin → auto-assign operator_staff role + caller's own company
      role_id = await userService.getOperatorStaffRoleId();
      company_id = req.user.company_id;
      association_id = req.user.association_id || null;
    }

    const user = await userService.createUser({
      name,
      username,
      email,
      password,
      role_id,
      association_id,
      company_id,
    });

    return successResponse(
      res,
      serialize(user),
      "User created successfully",
      201,
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// PUT /api/users/:id  &  PUT /api/users/update/:id — single update handler
exports.updateUser = async (req, res) => {
  try {
    const targetUser = await userService.getUserById(req.params.id);

    const userPolicy = policy("user", req.user, targetUser);
    if (!userPolicy.update()) {
      throw new ForbiddenError(
        "You can only update users within your own company.",
      );
    }

    // Only admins may change role_id
    if (!userPolicy.isAdmin()) delete req.body.role_id;

    // Only superadmins may reassign tenancy-related fields
    if (!userPolicy.isAdmin()) {
      delete req.body.company_id;
      delete req.body.association_id;
    }

    // Password confirmation (when provided)
    const confirmPw = req.body.confirmed_password || req.body.confPass;
    if (req.body.password && confirmPw && req.body.password !== confirmPw) {
      throw new BadRequestError("Password and confirm password do not match.");
    }

    const user = await userService.updateUser(req.params.id, req.body);

    return successResponse(res, serialize(user), "User updated successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// DELETE /api/users/:id — policy-authorized
exports.deleteUser = async (req, res) => {
  try {
    const targetUser = await userService.getUserById(req.params.id);

    if (!policy("user", req.user, targetUser).destroy()) {
      throw new ForbiddenError(
        "You can only delete users within your own company.",
      );
    }

    await userService.deleteUser(req.params.id);

    return successResponse(res, null, "User deleted successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};
