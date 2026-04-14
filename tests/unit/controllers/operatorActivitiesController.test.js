/**
 * Unit Tests: operatorActivitiesController
 *
 * Tests the controller logic in isolation by mocking Sequelize models.
 * Covers: createOperatorActivity, getOperatorsByActivityId, helpers.
 */

// Mock the Sequelize connection and models before any require
const mockModel = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  belongsTo: jest.fn(),
  hasMany: jest.fn(),
};

jest.mock("../../../config/db", () => ({
  define: jest.fn(() => ({ ...mockModel })),
  authenticate: jest.fn(),
  sync: jest.fn(),
}));

jest.mock("sequelize-paginate", () => ({ paginate: jest.fn() }));

// Now require — models will use the mocked sequelize
const OperatorActivity = require("../../../models/operatorActivitiesModel");
const controller = require("../../../controllers/operatorActivitiesController");

// Helper to create mock Express req/res
function mockReqRes(overrides = {}) {
  const req = {
    params: {},
    body: {},
    query: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ─── Helper function tests ───

describe("parseJSONField (via controller response mapping)", () => {
  afterEach(() => jest.clearAllMocks());

  test("should return [] for invalid JSON strings", async () => {
    const mockData = [
      {
        dataValues: { id: 1 },
        operator: { id: 10, name: "Biz", company: { company_name: "Biz" } },
        services_provided: "not-valid-json{{{",
        available_dates: "also-invalid",
      },
    ];
    OperatorActivity.findAll = jest.fn().mockResolvedValue(mockData);

    const { req, res } = mockReqRes({ params: { activityId: "1" } });
    await controller.getOperatorsByActivityId(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].services_provided_list).toEqual([]);
    expect(result[0].available_dates_list).toEqual([]);
  });
});

describe("derivePriceFromDates (via createOperatorActivity)", () => {
  afterEach(() => jest.clearAllMocks());

  test("should derive price_per_pax from available_dates when not provided", async () => {
    const createdRecord = {
      id: 1,
      activity_id: 5,
      user_id: 10,
      address: "Test Address",
      price_per_pax: 75,
      available_dates: [
        { date: "2026-03-10", time: "Full Day", price: 75 },
        { date: "2026-03-11", time: "Full Day", price: 75 },
      ],
    };
    OperatorActivity.create = jest.fn().mockResolvedValue(createdRecord);

    const { req, res } = mockReqRes({
      body: {
        activity_id: 5,
        user_id: 10,
        address: "Test Address",
        available_dates: [
          { date: "2026-03-10", time: "Full Day", price: 75 },
          { date: "2026-03-11", time: "Full Day", price: 75 },
        ],
        // price_per_pax intentionally omitted
      },
    });

    await controller.createOperatorActivity(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(OperatorActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ price_per_pax: 75 }),
    );
  });

  test("should use explicit price_per_pax when provided", async () => {
    const createdRecord = { id: 1, price_per_pax: 100 };
    OperatorActivity.create = jest.fn().mockResolvedValue(createdRecord);

    const { req, res } = mockReqRes({
      body: {
        activity_id: 5,
        user_id: 10,
        address: "Test",
        price_per_pax: 100,
        available_dates: [{ date: "2026-03-10", time: "Full Day", price: 75 }],
      },
    });

    await controller.createOperatorActivity(req, res);

    expect(OperatorActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ price_per_pax: 100 }),
    );
  });

  test("should default price_per_pax to 0 with no dates", async () => {
    const createdRecord = { id: 1, price_per_pax: 0 };
    OperatorActivity.create = jest.fn().mockResolvedValue(createdRecord);

    const { req, res } = mockReqRes({
      body: {
        activity_id: 5,
        user_id: 10,
        address: "Test",
        // no available_dates, no price_per_pax
      },
    });

    await controller.createOperatorActivity(req, res);

    expect(OperatorActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ price_per_pax: 0 }),
    );
  });

  test("should preserve explicit price_per_pax of 0", async () => {
    const createdRecord = { id: 1, price_per_pax: 0 };
    OperatorActivity.create = jest.fn().mockResolvedValue(createdRecord);

    const { req, res } = mockReqRes({
      body: {
        activity_id: 5,
        user_id: 10,
        address: "Test",
        price_per_pax: 0, // explicitly 0
        available_dates: [{ date: "2026-03-10", time: "Full Day", price: 999 }],
      },
    });

    await controller.createOperatorActivity(req, res);

    // Should use 0 (explicit), NOT 999 (derived)
    expect(OperatorActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ price_per_pax: 0 }),
    );
  });
});

// ─── createOperatorActivity validation ───

describe("createOperatorActivity - validation", () => {
  afterEach(() => jest.clearAllMocks());

  test("should return 400 if user_id is missing", async () => {
    const { req, res } = mockReqRes({
      body: { activity_id: 5 },
    });

    await controller.createOperatorActivity(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("user_id") }),
    );
  });

  test("should return 400 if activity_id is missing", async () => {
    const { req, res } = mockReqRes({
      body: { user_id: 10 },
    });

    await controller.createOperatorActivity(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("activity_id"),
      }),
    );
  });

  test("should parse user_id and activity_id as integers", async () => {
    OperatorActivity.create = jest.fn().mockResolvedValue({ id: 1 });

    const { req, res } = mockReqRes({
      body: {
        activity_id: "5",
        user_id: "10",
        address: "Test",
      },
    });

    await controller.createOperatorActivity(req, res);

    expect(OperatorActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_id: 5,
        user_id: 10,
      }),
    );
  });
});

// ─── getOperatorsByActivityId ───

describe("getOperatorsByActivityId", () => {
  afterEach(() => jest.clearAllMocks());

  test("should read activityId from req.params (not activity_id)", async () => {
    OperatorActivity.findAll = jest.fn().mockResolvedValue([
      {
        dataValues: { id: 1, activity_id: 2 },
        operator: { id: 10, name: "TestBiz", company: { company_name: "TestBiz" } },
        services_provided: null,
        available_dates: null,
      },
    ]);

    const { req, res } = mockReqRes({
      params: { activityId: "2" }, // route param name
    });

    await controller.getOperatorsByActivityId(req, res);

    expect(OperatorActivity.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activity_id: "2" },
      }),
    );
    expect(res.json).toHaveBeenCalled();
  });

  test("should return 404 when no operators found", async () => {
    OperatorActivity.findAll = jest.fn().mockResolvedValue([]);

    const { req, res } = mockReqRes({
      params: { activityId: "999" },
    });

    await controller.getOperatorsByActivityId(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("should parse JSON services_provided and available_dates", async () => {
    const mockData = [
      {
        dataValues: { id: 1 },
        operator: { id: 10, name: "Biz", company: { company_name: "Biz" } },
        services_provided: JSON.stringify([
          { title: "Safety", description: "Life jacket" },
        ]),
        available_dates: [{ date: "2026-03-10", time: "Full Day", price: 50 }],
      },
    ];
    OperatorActivity.findAll = jest.fn().mockResolvedValue(mockData);

    const { req, res } = mockReqRes({
      params: { activityId: "1" },
    });

    await controller.getOperatorsByActivityId(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].services_provided_list).toEqual([
      { title: "Safety", description: "Life jacket" },
    ]);
    expect(result[0].available_dates_list).toEqual([
      { date: "2026-03-10", time: "Full Day", price: 50 },
    ]);
  });
});
