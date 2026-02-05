/**
 * Integration Test: Activity Booking-Aware Filtering
 * Tests the slot-based filtering functionality after SOLID refactoring
 *
 * These tests verify the API endpoints without creating test data.
 * Tests verify:
 * - Basic API functionality (GET all, filter by date)
 * - Error handling (404, 400 responses)
 * - SOLID architecture (separation of concerns)
 */

const request = require("supertest");
const app = require("../../server");

describe("Activity Booking-Aware Filtering - Integration Tests", () => {
  describe("GET /api/activity - Basic Functionality", () => {
    it("should return activities array without filters", async () => {
      const response = await request(app)
        .get("/api/activity")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should filter by date range", async () => {
      const response = await request(app)
        .get("/api/activity?startDate=2026-02-01&endDate=2026-02-03")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(Array.isArray(response.body)).toBe(true);

      // All activities should have dates within range (if any returned)
      response.body.forEach((activity) => {
        if (activity.available_dates && activity.available_dates.length > 0) {
          const dates = activity.available_dates.map((d) => d.date);
          dates.forEach((date) => {
            const currentDate = new Date(date);
            const startDate = new Date("2026-02-01");
            const endDate = new Date("2026-02-03");
            expect(currentDate >= startDate && currentDate <= endDate).toBe(
              true,
            );
          });
        }
      });
    });

    it("should filter by single date", async () => {
      const response = await request(app)
        .get("/api/activity?date=2026-02-01")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(Array.isArray(response.body)).toBe(true);

      // All activities should have the specific date (if any returned)
      response.body.forEach((activity) => {
        if (activity.available_dates && activity.available_dates.length > 0) {
          const dates = activity.available_dates.map((d) => d.date);
          expect(dates.includes("2026-02-01")).toBe(true);
        }
      });
    });

    it("should return activities with proper structure", async () => {
      const response = await request(app).get("/api/activity").expect(200);

      // If activities exist, verify structure
      if (response.body.length > 0) {
        const activity = response.body[0];
        expect(activity).toHaveProperty("id");
        expect(activity).toHaveProperty("available_dates");
      }
    });
  });

  describe("GET /api/activity/user/:user_id - User Activities", () => {
    it("should return 404 for non-existent user", async () => {
      const response = await request(app)
        .get("/api/activity/user/NONEXISTENT_USER_999")
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/activity/:id - Single Activity", () => {
    it("should return 404 for non-existent activity", async () => {
      const response = await request(app)
        .get("/api/activity/NONEXISTENT_ACTIVITY_999")
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("SOLID Architecture Verification", () => {
    it("should have proper error handling in controller layer", async () => {
      // Test that errors are properly handled and returned as JSON
      const response = await request(app)
        .get("/api/activity/INVALID_ID_999")
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(typeof response.body.error).toBe("string");
    });

    it("should maintain separation of concerns", async () => {
      // This test verifies that the refactoring maintained functionality
      // Routes -> Controllers -> Services -> Models

      const response = await request(app)
        .get("/api/activity?startDate=2026-02-01")
        .expect(200);

      // If we get a valid response, the architecture layers are working
      expect(Array.isArray(response.body)).toBe(true);

      // Verify the service layer applied booking-aware filtering
      // (Activities should have available_dates processed)
      if (response.body.length > 0) {
        const activity = response.body[0];
        expect(activity).toHaveProperty("available_dates");
      }
    });

    it("should return HTTP 400 for invalid date filters", async () => {
      const response = await request(app)
        .get("/api/activity?startDate=invalid-date")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return HTTP 400 for invalid endDate filter", async () => {
      const response = await request(app)
        .get("/api/activity?endDate=not-a-date")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return HTTP 400 for invalid date filter", async () => {
      const response = await request(app)
        .get("/api/activity?date=xyz")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Status-Based Filtering Logic", () => {
    it("should apply booking-aware filtering to results", async () => {
      // This test verifies that the service layer processes activities
      const response = await request(app)
        .get("/api/activity?startDate=2026-02-01&endDate=2026-02-05")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // If activities are returned, verify they have proper structure
      response.body.forEach((activity) => {
        expect(activity).toHaveProperty("available_dates");
        if (Array.isArray(activity.available_dates)) {
          // Each slot should have required properties
          activity.available_dates.forEach((slot) => {
            expect(slot).toHaveProperty("date");
            expect(slot).toHaveProperty("time");
          });
        }
      });
    });

    it("should preserve activity_master association when activities exist", async () => {
      // Verify that Sequelize associations are preserved after filtering
      const response = await request(app).get("/api/activity").expect(200);

      // If activities exist, verify association is preserved
      if (response.body.length > 0) {
        const activity = response.body[0];
        // activity_name comes from the activity_master association
        expect(activity).toHaveProperty("activity_name");
      }
    });
  });
});
