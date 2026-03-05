/**
 * Unit Tests: activityMasterDataController
 *
 * Covers the date-merge logic that combines operator available_dates
 * into the master activity response. This logic was fixed to handle
 * both plain date strings ("2026-03-10") and date objects
 * ({date: "2026-03-10", time: "Full Day", price: 50}).
 */

// Mock the Sequelize connection so model definitions don't need a real DB
const mockModel = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
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

const ActivityMaster = require("../../../models/activityMasterDataModel");
const controller = require("../../../controllers/activityMasterDataController");

function mockReqRes(overrides = {}) {
  const req = { params: {}, body: {}, query: {}, ...overrides };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ─── Date merge logic in getAllActivities ───

describe("getAllActivities - date merging", () => {
  afterEach(() => jest.clearAllMocks());

  test("should extract date strings from plain string arrays", async () => {
    ActivityMaster.findAll = jest.fn().mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          activity_name: "Kayaking",
          operator_activities: [
            { available_dates: ["2026-03-10", "2026-03-11"] },
          ],
        }),
      },
    ]);

    const { req, res } = mockReqRes();
    await controller.getAllActivities(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].available_dates).toEqual(["2026-03-10", "2026-03-11"]);
    // operator_activities should be stripped from response
    expect(result[0].operator_activities).toBeUndefined();
  });

  test("should extract date strings from object arrays {date, time, price}", async () => {
    ActivityMaster.findAll = jest.fn().mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          activity_name: "Hiking",
          operator_activities: [
            {
              available_dates: [
                { date: "2026-04-01", time: "Full Day", price: 100 },
                { date: "2026-04-02", time: "Morning", price: 80 },
              ],
            },
          ],
        }),
      },
    ]);

    const { req, res } = mockReqRes();
    await controller.getAllActivities(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].available_dates).toEqual(["2026-04-01", "2026-04-02"]);
  });

  test("should handle mixed string and object dates from multiple operators", async () => {
    ActivityMaster.findAll = jest.fn().mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          activity_name: "Rafting",
          operator_activities: [
            {
              available_dates: ["2026-05-01", "2026-05-03"],
            },
            {
              available_dates: [
                { date: "2026-05-02", time: "Full Day", price: 50 },
                { date: "2026-05-03", time: "Full Day", price: 50 }, // duplicate
              ],
            },
          ],
        }),
      },
    ]);

    const { req, res } = mockReqRes();
    await controller.getAllActivities(req, res);

    const result = res.json.mock.calls[0][0];
    // Should deduplicate and sort
    expect(result[0].available_dates).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
  });

  test("should handle activity with no operators", async () => {
    ActivityMaster.findAll = jest.fn().mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          activity_name: "Empty",
          operator_activities: [],
        }),
      },
    ]);

    const { req, res } = mockReqRes();
    await controller.getAllActivities(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].available_dates).toEqual([]);
  });

  test("should handle null available_dates gracefully", async () => {
    ActivityMaster.findAll = jest.fn().mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          activity_name: "Null dates",
          operator_activities: [{ available_dates: null }],
        }),
      },
    ]);

    const { req, res } = mockReqRes();
    await controller.getAllActivities(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].available_dates).toEqual([]);
  });

  test("should skip entries with no date field", async () => {
    ActivityMaster.findAll = jest.fn().mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          activity_name: "Bad data",
          operator_activities: [
            {
              available_dates: [
                { date: "2026-06-01", time: "Full Day", price: 50 },
                { time: "Morning", price: 30 }, // missing date field
                "2026-06-02",
              ],
            },
          ],
        }),
      },
    ]);

    const { req, res } = mockReqRes();
    await controller.getAllActivities(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].available_dates).toEqual(["2026-06-01", "2026-06-02"]);
  });
});
