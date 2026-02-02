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
const User = require("../models/userModel");
const TouristUser = require("../models/touristModel");
const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");

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
    // Create operator user
    operatorUser = await User.create({
      username: "test_operator",
      full_name: "Test Operator",
      password: "hashedpassword123",
      user_email: "operator@test.com",
      business_name: "Test Business",
      company_logo: "",
      securityQ1: "Test Q1",
      securityQ2: "Test Q2",
    });

    // Create tourist user
    touristUser = await TouristUser.create({
      username: "test_tourist",
      full_name: "Test Tourist",
      email: "tourist@test.com",
      contact_no: "1234567890",
      password: "hashedpassword123",
    });

    // Create activity master data
    activityMaster = await ActivityMasterData.create({
      activity_name: "Island Hopping",
      description: "Beautiful island hopping experience",
      price: 150.0,
    });

    // Create operator activity
    operatorActivity = await OperatorActivity.create({
      rt_user_id: operatorUser.user_id,
      activity_id: activityMaster.id,
      activity_name: "Island Hopping",
      price: 150.0,
      address: "Kota Kinabalu",
      max_capacity: 20,
    });

    // Create activity booking with status = "booked"
    activityBooking = await ActivityBooking.create({
      tourist_user_id: touristUser.tourist_user_id,
      operator_activity_id: operatorActivity.id,
      activity_id: activityMaster.id,
      activity_name: "Island Hopping",
      contact_name: "Test Tourist",
      contact_no: "1234567890",
      date: "2026-03-15",
      pax: 2,
      total_price: 300.0,
      status: "booked", // ✅ Initial status
      nationality: "Malaysian",
    });
  });

  afterEach(async () => {
    await FormResponse.destroy({ where: {} });
    await ActivityBooking.destroy({ where: {} });
    await OperatorActivity.destroy({ where: {} });
    await ActivityMasterData.destroy({ where: {} });
    await TouristUser.destroy({ where: {} });
    await User.destroy({ where: {} });
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
      operator_user_id: operatorUser.user_id,
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
      activity_booking_id: activityBooking.id, // ✅ Link to booking
    };

    const response = await request(app)
      .post("/api/form")
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
      operator_user_id: operatorUser.user_id,
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

    await request(app).post("/api/form").send(formPayload).expect(201);

    // Verify booking status remains "booked"
    const booking = await ActivityBooking.findByPk(activityBooking.id);
    expect(booking.status).toBe("booked"); // ✅ Should not change
  });

  test("Frontend should exclude 'paid' bookings from tourist list", async () => {
    // Mark booking as paid
    await activityBooking.update({ status: "paid" });

    // Simulate frontend API call to get operator bookings
    const response = await request(app)
      .get(`/api/operator-bookings/user/${operatorUser.user_id}`)
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
      contact_no: "1234567890",
      date: "2026-03-20",
      pax: 3,
      total_price: 450.0,
      status: "booked",
      nationality: "Malaysian",
    });

    // Create form for first booking only
    const formPayload = {
      receipt_id: "PE1111111",
      operator_user_id: operatorUser.user_id,
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

    await request(app).post("/api/form").send(formPayload).expect(201);

    // Verify first booking is paid
    const b1 = await ActivityBooking.findByPk(activityBooking.id);
    expect(b1.status).toBe("paid");

    // Verify second booking is still booked
    const b2 = await ActivityBooking.findByPk(booking2.id);
    expect(b2.status).toBe("booked");
  });
});
