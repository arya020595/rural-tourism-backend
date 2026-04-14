/**
 * Integration Test: Booking Status Update on Form Response Creation
 *
 * Test Flow:
 * 1. Create activity booking with status = "booked"
 * 2. Create form_response with activity_booking_id
 * 3. Verify booking status changed to "paid"
 */

const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/db");
const ActivityBooking = require("../models/bookingActivityModel");
const FormResponse = require("../models/formModel");
const UnifiedUser = require("../models/unifiedUserModel");
const TouristUser = require("../models/touristModel");
const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const { generateToken } = require("../middleware/auth");

const adminToken = generateToken({
  id: 1,
  unified_user_id: 1,
  user_type: "operator",
  username: "integration_admin",
  role: "admin",
  permissions: ["*:*"],
});

const withAdminAuth = (req) => req.set("Authorization", `Bearer ${adminToken}`);

describe("Booking Status Update Integration Test", () => {
  let operatorUser;
  let touristUser;
  let activityMaster;
  let operatorActivity;
  let activityBooking;

  beforeAll(async () => {
    // Just ensure connection, don't force sync
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    // Create unified operator user
    operatorUser = await UnifiedUser.create({
      name: "Test Operator",
      username: `test_operator_${uniqueSuffix}`,
      email: `operator_${uniqueSuffix}@test.com`,
      password: "hashedpassword123",
      confirm_password: "hashedpassword123",
    });

    // Create tourist user
    touristUser = await TouristUser.create({
      username: `test_tourist_${uniqueSuffix}`,
      full_name: "Test Tourist",
      email: `tourist_${uniqueSuffix}@test.com`,
      contact_no: "1234567890",
      password: "hashedpassword123",
      nationality: "Malaysian",
    });

    // Create activity master data
    activityMaster = await ActivityMasterData.create({
      activity_name: "Island Hopping",
      description: "Beautiful island hopping experience",
      price: 150.0,
    });

    // Create operator activity
    operatorActivity = await OperatorActivity.create({
      user_id: operatorUser.id,
      activity_id: activityMaster.id,
      description: "Beautiful island hopping experience",
      district: "Kota Kinabalu",
      address: "Kota Kinabalu",
      services_provided: ["Boat", "Guide", "Snorkeling"],
      price_per_pax: 150.0,
    });

    // Create activity booking with status = "booked"
    activityBooking = await ActivityBooking.create({
      tourist_user_id: touristUser.tourist_user_id,
      operator_activity_id: operatorActivity.id,
      activity_id: activityMaster.id,
      contact_name: "Test Tourist",
      contact_phone: "1234567890",
      date: "2026-03-15",
      no_of_pax: 2,
      total_price: 300.0,
      status: "booked", // ✅ Initial status
      nationality: "Malaysian",
    });
  });

  afterEach(async () => {
    if (touristUser?.tourist_user_id) {
      await FormResponse.destroy({
        where: { tourist_user_id: touristUser.tourist_user_id },
      });
      await ActivityBooking.destroy({
        where: { tourist_user_id: touristUser.tourist_user_id },
      });
      await TouristUser.destroy({
        where: { tourist_user_id: touristUser.tourist_user_id },
      });
    }

    if (operatorActivity?.id) {
      await OperatorActivity.destroy({ where: { id: operatorActivity.id } });
    }

    if (activityMaster?.id) {
      await ActivityMasterData.destroy({ where: { id: activityMaster.id } });
    }

    if (operatorUser?.id) {
      await UnifiedUser.destroy({ where: { id: operatorUser.id } });
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("Should update booking status from 'booked' to 'paid' after form creation", async () => {
    // Step 1: Verify initial booking status is "booked"
    let booking = await ActivityBooking.findByPk(activityBooking.id);
    expect(booking.status).toBe("booked");

    // Step 2: Create form response with activity_booking_id
    const formPayload = {
      receipt_id: "PE1234567",
      operator_user_id: operatorUser.id,
      tourist_user_id: touristUser.tourist_user_id,
      citizenship: "Malaysian",
      pax: 2,
      activity_id: activityMaster.id,
      activity_name: "Island Hopping",
      location: "Kota Kinabalu",
      total_rm: "300.00",
      date: "2026-03-15",
      issuer: "Test Operator",
      activity_booking_id: activityBooking.id, // ✅ Link to booking
    };

    const response = await withAdminAuth(request(app).post("/api/form"))
      .send(formPayload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("receipt_id", "PE1234567");

    // Step 3: Verify booking status changed to "paid"
    booking = await ActivityBooking.findByPk(activityBooking.id);
    expect(booking.status).toBe("paid"); // ✅ Status should be updated
  });

  test("Should NOT update booking status if activity_booking_id is not provided", async () => {
    // Create form without activity_booking_id
    const formPayload = {
      receipt_id: "PE9999999",
      operator_user_id: operatorUser.id,
      tourist_user_id: touristUser.tourist_user_id,
      citizenship: "Malaysian",
      pax: 2,
      pax_domestik: 2,
      pax_antarabangsa: 0,
      activity_id: activityMaster.id,
      activity_name: "Island Hopping",
      location: "Kota Kinabalu",
      total_rm: "300.00",
      date: "2026-03-15",
      issuer: "Test Operator",
      // activity_booking_id: null, // ❌ Not provided
    };

    await withAdminAuth(request(app).post("/api/form"))
      .send(formPayload)
      .expect(201);

    // Verify booking status remains "booked"
    const booking = await ActivityBooking.findByPk(activityBooking.id);
    expect(booking.status).toBe("booked"); // ✅ Should not change
  });

  test("Should filter out 'paid' bookings from operator bookings list", async () => {
    // Mark booking as paid
    await activityBooking.update({ status: "paid" });

    // Simulate frontend API call to get operator bookings
    const response = await request(app)
      .get(`/api/operator-bookings/user/${operatorUser.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    const bookings = response.body.data;

    // Filter bookings like frontend does (status: booked, pending only)
    const unpaidBookings = bookings.filter((b) => {
      const status = (b.status || "").trim().toLowerCase();
      return ["booked", "pending"].includes(status);
    });

    // ✅ Paid booking should be excluded
    expect(unpaidBookings).toHaveLength(0);
  });

  test("Should handle multiple bookings correctly", async () => {
    // Create second booking
    const booking2 = await ActivityBooking.create({
      tourist_user_id: touristUser.tourist_user_id,
      operator_activity_id: operatorActivity.id,
      activity_id: activityMaster.id,
      activity_name: "Island Hopping",
      contact_name: "Test Tourist",
      contact_phone: "1234567890",
      date: "2026-03-20",
      no_of_pax: 3,
      total_price: 450.0,
      status: "booked",
      nationality: "Malaysian",
    });

    // Create form for first booking only
    const formPayload = {
      receipt_id: "PE1111111",
      operator_user_id: operatorUser.id,
      tourist_user_id: touristUser.tourist_user_id,
      citizenship: "Malaysian",
      pax: 2,
      activity_id: activityMaster.id,
      activity_name: "Island Hopping",
      total_rm: "300.00",
      date: "2026-03-15",
      issuer: "Test Operator",
      activity_booking_id: activityBooking.id,
    };

    await withAdminAuth(request(app).post("/api/form"))
      .send(formPayload)
      .expect(201);

    // Verify first booking is paid
    const b1 = await ActivityBooking.findByPk(activityBooking.id);
    expect(b1.status).toBe("paid");

    // Verify second booking is still booked
    const b2 = await ActivityBooking.findByPk(booking2.id);
    expect(b2.status).toBe("booked");
  });
});
