const request = require("supertest");
const app = require("../../../server");
const ActivityMasterData = require("../../../models/activityMasterDataModel");
const { generateToken } = require("../../../middleware/auth");

const adminToken = generateToken({
  id: 1,
  unified_user_id: 1,
  user_type: "operator",
  username: "integration_admin",
  role: "admin",
  permissions: ["*:*"],
});

const withAdminAuth = (req) =>
  req.set("Authorization", `Bearer ${adminToken}`);

describe("Activity Master Data API - Integration Tests", () => {
  // Test data
  const testActivities = [
    {
      activity_name: "Test Beach Activity",
      description: "A fun beach activity for testing",
      address: "Test Beach, Sabah",
      things_to_know: JSON.stringify({ requirements: "Must know swimming" }),
      image: "assets/test-beach.jpg",
    },
    {
      activity_name: "Test Mountain Hiking",
      description: "Challenging mountain hike",
      address: "Test Mountain, Sabah",
      things_to_know: JSON.stringify({
        requirements: "Good physical condition",
      }),
      image: "assets/test-mountain.jpg",
    },
    {
      activity_name: "Test Cultural Tour",
      description: "Cultural heritage tour",
      address: "Test Village, Sabah",
      things_to_know: JSON.stringify({ requirements: "All ages welcome" }),
      image: "assets/test-culture.jpg",
    },
  ];

  // Clean up test data before each test
  beforeEach(async () => {
    await ActivityMasterData.destroy({
      where: {
        activity_name: {
          [require("sequelize").Op.like]: "Test%",
        },
      },
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    await ActivityMasterData.destroy({
      where: {
        activity_name: {
          [require("sequelize").Op.like]: "Test%",
        },
      },
    });
  });

  describe("GET /api/activity-master-data", () => {
    test("should return all activities with default pagination", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data"),
      )
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty("total");
      expect(response.body.pagination).toHaveProperty("page");
      expect(response.body.pagination).toHaveProperty("per_page");
    });

    test("should support custom pagination", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?page=1&per_page=2"),
      )
        .expect(200);

      expect(response.body.pagination.per_page).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Ransack Search Features", () => {
    beforeEach(async () => {
      // Create test data
      await ActivityMasterData.bulkCreate(testActivities);
    });

    test("should search by activity name containing text (cont predicate)", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?q[activity_name_cont]=Beach"),
      )
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].activity_name).toContain("Beach");
    });

    test("should search by activity name starting with text (start predicate)", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?q[activity_name_start]=Test Beach"),
      )
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].activity_name).toMatch(/^Test Beach/);
    });

    test("should search by activity name ending with text (end predicate)", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?q[activity_name_end]=Hiking"),
      )
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].activity_name).toMatch(/Hiking$/);
    });

    test("should filter by ID greater than (gt predicate)", async () => {
      const allActivities = await ActivityMasterData.findAll({
        where: { activity_name: { [require("sequelize").Op.like]: "Test%" } },
        order: [["id", "ASC"]],
      });
      const firstId = allActivities[0].id;

      const response = await withAdminAuth(
        request(app).get(`/api/activity-master-data?q[id_gt]=${firstId}`),
      )
        .expect(200);

      response.body.data.forEach((activity) => {
        expect(activity.id).toBeGreaterThan(firstId);
      });
    });

    test("should filter by ID less than or equal (lte predicate)", async () => {
      const allActivities = await ActivityMasterData.findAll({
        where: { activity_name: { [require("sequelize").Op.like]: "Test%" } },
        order: [["id", "DESC"]],
      });
      const lastId = allActivities[0].id;

      const response = await withAdminAuth(
        request(app).get(`/api/activity-master-data?q[id_lte]=${lastId}`),
      )
        .expect(200);

      response.body.data.forEach((activity) => {
        expect(activity.id).toBeLessThanOrEqual(lastId);
      });
    });

    test("should filter by exact match (eq predicate)", async () => {
      const response = await withAdminAuth(
        request(app).get(
          "/api/activity-master-data?q[activity_name_eq]=Test Beach Activity",
        ),
      )
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].activity_name).toBe("Test Beach Activity");
    });

    test("should filter by not equals (not_eq predicate)", async () => {
      const response = await withAdminAuth(
        request(app).get(
          "/api/activity-master-data?q[activity_name_not_eq]=Test Beach Activity",
        ),
      )
        .expect(200);

      response.body.data.forEach((activity) => {
        expect(activity.activity_name).not.toBe("Test Beach Activity");
      });
    });

    test("should combine multiple search predicates", async () => {
      const response = await withAdminAuth(
        request(app).get(
          "/api/activity-master-data?q[activity_name_cont]=Test&q[description_cont]=activity",
        ),
      )
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((activity) => {
        expect(activity.activity_name).toContain("Test");
        expect(activity.description.toLowerCase()).toContain("activity");
      });
    });
  });

  describe("Sorting Features", () => {
    beforeEach(async () => {
      await ActivityMasterData.bulkCreate(testActivities);
    });

    test("should sort by activity_name ascending", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?sort=activity_name&order=ASC"),
      )
        .expect(200);

      const names = response.body.data.map((a) => a.activity_name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    test("should sort by activity_name descending", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?sort=activity_name_desc"),
      )
        .expect(200);

      const names = response.body.data.map((a) => a.activity_name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    test("should sort by id ascending", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data?sort=id_asc"),
      )
        .expect(200);

      const ids = response.body.data.map((a) => a.id);
      const sortedIds = [...ids].sort((a, b) => a - b);
      expect(ids).toEqual(sortedIds);
    });
  });

  describe("GET /api/activity-master-data/:id", () => {
    let testActivityId;

    beforeEach(async () => {
      const activity = await ActivityMasterData.create(testActivities[0]);
      testActivityId = activity.id;
    });

    test("should return a single activity by ID", async () => {
      const response = await withAdminAuth(
        request(app).get(`/api/activity-master-data/${testActivityId}`),
      )
        .expect(200);

      expect(response.body).toHaveProperty("id", testActivityId);
      expect(response.body).toHaveProperty("activity_name");
      expect(response.body).toHaveProperty("description");
    });

    test("should return 404 for non-existent activity", async () => {
      const response = await withAdminAuth(
        request(app).get("/api/activity-master-data/99999"),
      )
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/activity-master-data", () => {
    test("should create a new activity", async () => {
      const newActivity = {
        activity_name: "Test New Activity",
        description: "A brand new activity",
        address: "New Location, Sabah",
        things_to_know: JSON.stringify({ requirements: "None" }),
        image: "assets/test-new.jpg",
      };

      const response = await withAdminAuth(
        request(app).post("/api/activity-master-data"),
      )
        .send(newActivity)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.activity_name).toBe(newActivity.activity_name);
      expect(response.body.description).toBe(newActivity.description);

      // Clean up
      await ActivityMasterData.destroy({ where: { id: response.body.id } });
    });

    test("should return error when required fields are missing", async () => {
      const invalidActivity = {
        description: "Missing activity name",
      };

      await withAdminAuth(request(app).post("/api/activity-master-data"))
        .send(invalidActivity)
        .expect(500);
    });
  });

  describe("PUT /api/activity-master-data/:id", () => {
    let testActivityId;

    beforeEach(async () => {
      const activity = await ActivityMasterData.create(testActivities[0]);
      testActivityId = activity.id;
    });

    test("should update an existing activity", async () => {
      const updatedData = {
        activity_name: "Updated Test Beach Activity",
        description: "Updated description",
        address: "Updated Beach, Sabah",
        things_to_know: JSON.stringify({
          requirements: "Updated requirements",
        }),
        image: "assets/updated-beach.jpg",
      };

      const response = await withAdminAuth(
        request(app).put(`/api/activity-master-data/${testActivityId}`),
      )
        .send(updatedData)
        .expect(200);

      expect(response.body.activity_name).toBe(updatedData.activity_name);
      expect(response.body.description).toBe(updatedData.description);
    });

    test("should return 404 when updating non-existent activity", async () => {
      const response = await withAdminAuth(
        request(app).put("/api/activity-master-data/99999"),
      )
        .send({ activity_name: "Test" })
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/activity-master-data/:id", () => {
    let testActivityId;

    beforeEach(async () => {
      const activity = await ActivityMasterData.create(testActivities[0]);
      testActivityId = activity.id;
    });

    test("should delete an activity", async () => {
      const response = await withAdminAuth(
        request(app).delete(`/api/activity-master-data/${testActivityId}`),
      )
        .expect(200);

      expect(response.body).toHaveProperty("message");

      // Verify deletion
      const deletedActivity = await ActivityMasterData.findByPk(testActivityId);
      expect(deletedActivity).toBeNull();
    });

    test("should return 404 when deleting non-existent activity", async () => {
      const response = await withAdminAuth(
        request(app).delete("/api/activity-master-data/99999"),
      )
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Combined Search, Sort, and Pagination", () => {
    beforeEach(async () => {
      await ActivityMasterData.bulkCreate(testActivities);
    });

    test("should combine search, sort, and pagination", async () => {
      const response = await withAdminAuth(
        request(app).get(
          "/api/activity-master-data?q[activity_name_cont]=Test&sort=activity_name_asc&page=1&per_page=2",
        ),
      )
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.per_page).toBe(2);

      const names = response.body.data.map((a) => a.activity_name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });
});
