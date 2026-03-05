const {
  buildSearchQuery,
  buildSort,
  buildPagination,
  ransackMiddleware,
} = require("../../../middleware/ransackSearch");
const { Op } = require("sequelize");

describe("Ransack Search Middleware - Unit Tests", () => {
  describe("buildSearchQuery", () => {
    test("should build query with cont predicate", () => {
      const queryParams = {
        q: {
          activity_name_cont: "Beach",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        activity_name: {
          [Op.like]: "%Beach%",
        },
      });
    });

    test("should build query with eq predicate", () => {
      const queryParams = {
        q: {
          id_eq: 5,
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        id: {
          [Op.eq]: 5,
        },
      });
    });

    test("should build query with gt predicate", () => {
      const queryParams = {
        q: {
          id_gt: 10,
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        id: {
          [Op.gt]: 10,
        },
      });
    });

    test("should build query with lte predicate", () => {
      const queryParams = {
        q: {
          price_lte: 100,
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        price: {
          [Op.lte]: 100,
        },
      });
    });

    test("should build query with start predicate", () => {
      const queryParams = {
        q: {
          activity_name_start: "Mount",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        activity_name: {
          [Op.startsWith]: "Mount",
        },
      });
    });

    test("should build query with end predicate", () => {
      const queryParams = {
        q: {
          activity_name_end: "Tour",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        activity_name: {
          [Op.endsWith]: "Tour",
        },
      });
    });

    test("should build query with in predicate", () => {
      const queryParams = {
        q: {
          id_in: "1,2,3",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        id: {
          [Op.in]: ["1", "2", "3"],
        },
      });
    });

    test("should build query with not_eq predicate", () => {
      const queryParams = {
        q: {
          status_not_eq: "inactive",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        status: {
          [Op.ne]: "inactive",
        },
      });
    });

    test("should build query with not_cont predicate", () => {
      const queryParams = {
        q: {
          activity_name_not_cont: "Test",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        activity_name: {
          [Op.notLike]: "%Test%",
        },
      });
    });

    test("should combine multiple predicates", () => {
      const queryParams = {
        q: {
          activity_name_cont: "Beach",
          id_gt: 5,
          status_eq: "active",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        activity_name: {
          [Op.like]: "%Beach%",
        },
        id: {
          [Op.gt]: 5,
        },
        status: {
          [Op.eq]: "active",
        },
      });
    });

    test("should return empty object when no q params", () => {
      const queryParams = {};
      const where = buildSearchQuery(queryParams);
      expect(where).toEqual({});
    });

    test("should ignore invalid predicates", () => {
      const queryParams = {
        q: {
          activity_name_invalid: "value",
          activity_name_cont: "valid",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        activity_name: {
          [Op.like]: "%valid%",
        },
      });
    });
  });

  describe("buildSort", () => {
    test("should build sort with _desc suffix", () => {
      const queryParams = {
        sort: "activity_name_desc",
      };

      const order = buildSort(queryParams);

      expect(order).toEqual([["activity_name", "DESC"]]);
    });

    test("should build sort with _asc suffix", () => {
      const queryParams = {
        sort: "activity_name_asc",
      };

      const order = buildSort(queryParams);

      expect(order).toEqual([["activity_name", "ASC"]]);
    });

    test("should build sort with separate order param", () => {
      const queryParams = {
        sort: "created_at",
        order: "DESC",
      };

      const order = buildSort(queryParams);

      expect(order).toEqual([["created_at", "DESC"]]);
    });

    test("should default to ASC when no order specified", () => {
      const queryParams = {
        sort: "id",
      };

      const order = buildSort(queryParams);

      expect(order).toEqual([["id", "ASC"]]);
    });

    test("should return empty array when no sort params", () => {
      const queryParams = {};
      const order = buildSort(queryParams);
      expect(order).toEqual([]);
    });

    test("should handle lowercase order param", () => {
      const queryParams = {
        sort: "name",
        order: "desc",
      };

      const order = buildSort(queryParams);

      expect(order).toEqual([["name", "DESC"]]);
    });
  });

  describe("buildPagination", () => {
    test("should build pagination with page and per_page", () => {
      const queryParams = {
        page: "2",
        per_page: "20",
      };

      const pagination = buildPagination(queryParams);

      expect(pagination).toEqual({
        limit: 20,
        offset: 20,
      });
    });

    test("should use limit as fallback for per_page", () => {
      const queryParams = {
        page: "1",
        limit: "15",
      };

      const pagination = buildPagination(queryParams);

      expect(pagination).toEqual({
        limit: 15,
        offset: 0,
      });
    });

    test("should default to page 1 and 10 items", () => {
      const queryParams = {};

      const pagination = buildPagination(queryParams);

      expect(pagination).toEqual({
        limit: 10,
        offset: 0,
      });
    });

    test("should calculate correct offset for page 3", () => {
      const queryParams = {
        page: "3",
        per_page: "5",
      };

      const pagination = buildPagination(queryParams);

      expect(pagination).toEqual({
        limit: 5,
        offset: 10,
      });
    });

    test("should handle string numbers", () => {
      const queryParams = {
        page: "4",
        per_page: "25",
      };

      const pagination = buildPagination(queryParams);

      expect(pagination).toEqual({
        limit: 25,
        offset: 75,
      });
    });

    test("should handle invalid page numbers", () => {
      const queryParams = {
        page: "invalid",
        per_page: "invalid",
      };

      const pagination = buildPagination(queryParams);

      expect(pagination).toEqual({
        limit: 10,
        offset: 0,
      });
    });
  });

  describe("ransackMiddleware", () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    test("should attach ransack object to request", () => {
      req.query = {
        q: {
          activity_name_cont: "Beach",
        },
        sort: "id_desc",
        page: "1",
        per_page: "10",
      };

      ransackMiddleware(req, res, next);

      expect(req.ransack).toBeDefined();
      expect(req.ransack).toHaveProperty("where");
      expect(req.ransack).toHaveProperty("order");
      expect(req.ransack).toHaveProperty("limit");
      expect(req.ransack).toHaveProperty("offset");
      expect(next).toHaveBeenCalled();
    });

    test("should provide toSequelizeOptions helper", () => {
      req.query = {
        q: {
          activity_name_cont: "Beach",
        },
        sort: "id_desc",
        page: "2",
        per_page: "5",
      };

      ransackMiddleware(req, res, next);

      const options = req.ransack.toSequelizeOptions();

      expect(options).toHaveProperty("where");
      expect(options).toHaveProperty("order");
      expect(options).toHaveProperty("limit", 5);
      expect(options).toHaveProperty("offset", 5);
    });

    test("should handle empty query params", () => {
      req.query = {};

      ransackMiddleware(req, res, next);

      expect(req.ransack.where).toEqual({});
      expect(req.ransack.order).toEqual([]);
      expect(req.ransack.limit).toBe(10);
      expect(req.ransack.offset).toBe(0);
      expect(next).toHaveBeenCalled();
    });

    test("should handle errors gracefully", () => {
      // Create an error by passing invalid data
      req.query = null;

      ransackMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid search parameters",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Complex Query Scenarios", () => {
    test("should handle compound field names with underscores", () => {
      const queryParams = {
        q: {
          created_at_gte: "2025-01-01",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        created_at: {
          [Op.gte]: "2025-01-01",
        },
      });
    });

    test("should handle multiple conditions on same field", () => {
      const queryParams = {
        q: {
          price_gte: 100,
          price_lte: 500,
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where).toEqual({
        price: {
          [Op.gte]: 100,
          [Op.lte]: 500,
        },
      });
    });

    test("should handle whitespace in in predicate", () => {
      const queryParams = {
        q: {
          id_in: "1, 2, 3, 4",
        },
      };

      const where = buildSearchQuery(queryParams);

      expect(where.id[Op.in]).toEqual(["1", "2", "3", "4"]);
    });
  });
});
