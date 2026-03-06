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
