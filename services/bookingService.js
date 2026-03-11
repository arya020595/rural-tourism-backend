/**
 * Booking Service
 * Single Responsibility: Handle all business logic for booking operations
 * Separation of Concerns: Separate from form logic
 */

const ActivityBooking = require("../models/bookingActivityModel");
const AccommodationBooking = require("../models/bookingAccommodationModel");

/**
 * BookingService class
 * Handles booking state transitions and business rules
 */
class BookingService {
  /**
   * Mark activity booking as paid
   * @param {number} bookingId - Activity booking ID
   * @returns {Promise<boolean>} Success status
   */
  async markActivityBookingAsPaid(bookingId) {
    if (!bookingId) {
      return false;
    }

    const [updatedCount] = await ActivityBooking.update(
      { status: "paid" },
      { where: { id: bookingId } },
    );

    return updatedCount > 0;
  }

  /**
   * Mark accommodation booking as paid
   * @param {number} bookingId - Accommodation booking ID
   * @returns {Promise<boolean>} Success status
   */
  async markAccommodationBookingAsPaid(bookingId) {
    if (!bookingId) {
      return false;
    }

    const [updatedCount] = await AccommodationBooking.update(
      { status: "paid" },
      { where: { id: bookingId } },
    );

    return updatedCount > 0;
  }

  /**
   * Create a new manual activity booking (operator-created, status paid)
   * @param {object} params - Booking parameters
   * @returns {Promise<object>} Created booking
   */
  async createManualActivityBooking({
    tourist_user_id,
    activity_id,
    operator_activity_id,
    total_price,
    no_of_pax,
    date,
    time,
    nationality,
    contact_name,
    contact_phone,
  }) {
    const booking = await ActivityBooking.create({
      tourist_user_id,
      activity_id,
      operator_activity_id,
      total_price: parseFloat(total_price) || 0,
      no_of_pax: no_of_pax || null,
      date: date || null,
      time: time || null,
      nationality: nationality || null,
      contact_name: contact_name || null,
      contact_phone: contact_phone || null,
      status: "paid",
      booking_type: "manual",
    });
    return booking;
  }

  /**
   * Create a new manual accommodation booking (operator-created, status paid)
   * @param {object} params - Booking parameters
   * @returns {Promise<object>} Created booking
   */
  async createManualAccommodationBooking({
    tourist_user_id,
    accommodation_id,
    check_in,
    check_out,
    total_no_of_nights,
    total_price,
    no_of_pax,
    contact_name,
    contact_phone,
    contact_email,
    nationality,
  }) {
    const booking = await AccommodationBooking.create({
      tourist_user_id,
      accommodation_id,
      check_in,
      check_out,
      total_no_of_nights: parseInt(total_no_of_nights) || 1,
      total_price: String(total_price || "0"),
      no_of_pax: no_of_pax || null,
      contact_name: contact_name || "",
      contact_phone: contact_phone || null,
      contact_email: contact_email || null,
      nationality: nationality || null,
      status: "paid",
      booking_type: "manual",
    });
    return booking;
  }

  /**
   * Check if booking is eligible for payment
   * @param {number} bookingId - Booking ID
   * @param {string} type - 'activity' or 'accommodation'
   * @returns {Promise<boolean>} Eligibility status
   */
  async isEligibleForPayment(bookingId, type = "activity") {
    const Model = type === "activity" ? ActivityBooking : AccommodationBooking;
    const booking = await Model.findByPk(bookingId);

    if (!booking) {
      return false;
    }

    const status = booking.status?.toLowerCase();
    return status === "booked" || status === "pending";
  }
}

// Export singleton instance
const bookingService = new BookingService();

module.exports = {
  BookingService,
  bookingService,
};
