const { Op } = require("sequelize");

/**
 * Ransack-like search middleware for Sequelize
 * Supports query params like: ?q[activity_name_cont]=Beach&q[id_gt]=5
 *
 * Available predicates:
 * - _eq: equals
 * - _cont: contains (case-insensitive)
 * - _start: starts with
 * - _end: ends with
 * - _gt: greater than
 * - _gte: greater than or equal
 * - _lt: less than
 * - _lte: less than or equal
 * - _in: in array (comma-separated)
 * - _not_eq: not equals
 * - _not_cont: does not contain
 */
function buildSearchQuery(queryParams) {
  const where = {};
  const q = queryParams.q || {};

  // Mapping of predicates to Sequelize operators
  const predicateMap = {
    eq: Op.eq,
    cont: Op.like,
    start: Op.startsWith,
    end: Op.endsWith,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    in: Op.in,
    not_eq: Op.ne,
    not_cont: Op.notLike,
  };

  // Parse each query parameter
  Object.keys(q).forEach((key) => {
    // Try to match predicates with underscores first (not_eq, not_cont)
    let field, predicate;

    // Check for two-word predicates (not_eq, not_cont)
    if (key.includes("_not_eq")) {
      const parts = key.split("_not_eq");
      field = parts[0];
      predicate = "not_eq";
    } else if (key.includes("_not_cont")) {
      const parts = key.split("_not_cont");
      field = parts[0];
      predicate = "not_cont";
    } else {
      // Split key into field and predicate (e.g., "activity_name_cont" -> ["activity_name", "cont"])
      const parts = key.split("_");
      predicate = parts[parts.length - 1];
      field = parts.slice(0, -1).join("_");
    }

    if (predicateMap[predicate]) {
      let value = q[key];

      // Handle special cases
      if (predicate === "cont" || predicate === "not_cont") {
        value = `%${value}%`;
      } else if (predicate === "in") {
        value = value.split(",").map((v) => v.trim());
      }

      // Build where clause
      if (!where[field]) {
        where[field] = {};
      }
      where[field][predicateMap[predicate]] = value;
    }
  });

  return where;
}

/**
 * Build sorting from query params
 * Example: ?sort=activity_name&order=DESC
 * Or: ?sort=activity_name_desc
 */
function buildSort(queryParams) {
  const { sort, order } = queryParams;

  if (sort) {
    // Check if sort has _asc or _desc suffix
    if (sort.endsWith("_desc")) {
      const field = sort.replace("_desc", "");
      return [[field, "DESC"]];
    } else if (sort.endsWith("_asc")) {
      const field = sort.replace("_asc", "");
      return [[field, "ASC"]];
    }

    // Use separate order param
    const direction = order && order.toUpperCase() === "DESC" ? "DESC" : "ASC";
    return [[sort, direction]];
  }

  return [];
}

/**
 * Build pagination from query params
 * Example: ?page=2&per_page=10
 */
function buildPagination(queryParams) {
  const page = parseInt(queryParams.page) || 1;
  const perPage = parseInt(queryParams.per_page || queryParams.limit) || 10;

  return {
    limit: perPage,
    offset: (page - 1) * perPage,
  };
}

/**
 * Middleware to parse Ransack-like query params
 */
function ransackMiddleware(req, res, next) {
  try {
    const where = buildSearchQuery(req.query);
    const order = buildSort(req.query);
    const pagination = buildPagination(req.query);

    // Attach to request for use in route handlers
    req.ransack = {
      where,
      order,
      ...pagination,
      // Helper to build complete query options
      toSequelizeOptions: () => ({
        where,
        order,
        limit: pagination.limit,
        offset: pagination.offset,
      }),
    };

    next();
  } catch (error) {
    console.error("Ransack middleware error:", error);
    res.status(400).json({ error: "Invalid search parameters" });
  }
}

module.exports = {
  ransackMiddleware,
  buildSearchQuery,
  buildSort,
  buildPagination,
};
