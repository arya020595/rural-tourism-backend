/**
 * Accommodation Service
 * Business logic layer for accommodation booking-aware filtering
 *
 * Key Difference from Activity Service:
 * - Accommodations don't have time slots, only dates (check-in/check-out)
 * - A date is blocked if there's any booking for that date (no time slot checking)
 */

const AccommodationBooking = require("../models/bookingAccommodationModel");
const { Op } = require("sequelize");

class AccommodationService {
  /**
   * Get all booked dates for multiple accommodations (optimized single query)
   * @param {array} accommodationIds - Array of accommodation IDs
   * @returns {object} Map of accommodation_id -> array of booked dates
   */
  async getAllBookedDatesGrouped(accommodationIds) {
    if (!accommodationIds || accommodationIds.length === 0) return {};

    try {
      const bookings = await AccommodationBooking.findAll({
        where: {
          accommodation_id: accommodationIds,
          status: {
            [Op.in]: ["booked", "paid"], // Only count booked and paid
          },
        },
        attributes: ["accommodation_id", "check_in", "check_out"],
        raw: true,
      });

      // Group by accommodation_id and expand date ranges
      const bookedDatesMap = {};

      bookings.forEach((booking) => {
        const accommodationId = booking.accommodation_id;
        if (!bookedDatesMap[accommodationId]) {
          bookedDatesMap[accommodationId] = new Set();
        }

        // Generate all dates between check_in and check_out (inclusive)
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);

        for (
          let d = new Date(checkIn);
          d <= checkOut;
          d = new Date(d.getTime() + 86400000)
        ) {
          const dateStr = d.toISOString().split("T")[0];
          bookedDatesMap[accommodationId].add(dateStr);
        }
      });

      // Convert Sets to Arrays
      Object.keys(bookedDatesMap).forEach((id) => {
        bookedDatesMap[id] = Array.from(bookedDatesMap[id]);
      });

      return bookedDatesMap;
    } catch (error) {
      console.error("Error fetching booked dates:", error);
      return {};
    }
  }

  /**
   * Filter available dates by removing booked dates
   * @param {array} availableDates - Array of date strings OR date objects {date, time, price}
   * @param {array} bookedDates - Array of booked date strings
   * @returns {array} Available dates after removing booked ones
   */
  filterAvailableDates(availableDates, bookedDates = []) {
    if (!availableDates || !Array.isArray(availableDates)) return [];
    if (!bookedDates || bookedDates.length === 0) return availableDates;

    // Normalize dates for comparison
    const bookedDatesSet = new Set(
      bookedDates.map((date) => this.normalizeDate(date)),
    );

    return availableDates.filter((item) => {
      // Handle both string dates and date objects {date, time, price}
      const dateStr = typeof item === "string" ? item : item?.date;
      const normalized = this.normalizeDate(dateStr);
      return normalized && !bookedDatesSet.has(normalized);
    });
  }

  /**
   * Check if accommodation matches date filter criteria
   * @param {array} actualAvailableDates - Array of date strings OR date objects
   * @param {string} filterStartDate - Start date filter
   * @param {string} filterEndDate - End date filter
   * @returns {boolean} True if accommodation matches filter
   * @throws {Error} If date filter is invalid
   */
  matchesDateFilter(actualAvailableDates, filterStartDate, filterEndDate) {
    if (!filterStartDate && !filterEndDate) return true;
    if (!actualAvailableDates || actualAvailableDates.length === 0)
      return false;

    const normalizedStart = this.normalizeDate(filterStartDate);
    const normalizedEnd = this.normalizeDate(filterEndDate);

    if (filterStartDate && !normalizedStart) {
      throw new Error(
        `Invalid startDate filter: ${filterStartDate}. Expected format: YYYY-MM-DD`,
      );
    }
    if (filterEndDate && !normalizedEnd) {
      throw new Error(
        `Invalid endDate filter: ${filterEndDate}. Expected format: YYYY-MM-DD`,
      );
    }

    return actualAvailableDates.some((item) => {
      // Handle both string dates and date objects {date, time, price}
      const dateStr = typeof item === "string" ? item : item?.date;
      const normalizedDate = this.normalizeDate(dateStr);
      if (!normalizedDate) return false;

      return (
        normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd
      );
    });
  }

  /**
   * Apply booking-aware filtering to accommodations
   * @param {array} accommodations - Array of accommodations
   * @param {object} filters - Filter options { date, startDate, endDate }
   * @returns {array} Filtered accommodations with actual available dates
   * @throws {Error} If date filter is invalid
   */
  async applyBookingAwareFiltering(accommodations, filters = {}) {
    const { date, startDate, endDate } = filters;

    // Validate date filters early
    const filterStart = date || startDate;
    const filterEnd = date || endDate;

    if (filterStart) {
      const normalized = this.normalizeDate(filterStart);
      if (!normalized) {
        throw new Error(
          `Invalid ${date ? "date" : "startDate"} filter: ${filterStart}. Expected format: YYYY-MM-DD`,
        );
      }
    }

    if (filterEnd && !date) {
      const normalized = this.normalizeDate(filterEnd);
      if (!normalized) {
        throw new Error(
          `Invalid endDate filter: ${filterEnd}. Expected format: YYYY-MM-DD`,
        );
      }
    }

    // Optimize: Fetch all bookings in ONE query
    const accommodationIds = accommodations.map((a) => a.accommodation_id);
    const bookedDatesMap =
      await this.getAllBookedDatesGrouped(accommodationIds);

    // Process each accommodation with pre-fetched booking data
    const processedAccommodations = accommodations.map((accommodation) => {
      const bookedDates = bookedDatesMap[accommodation.accommodation_id] || [];
      const originalAvailableDates = this.parseJSONField(
        accommodation.available_dates,
      );
      let actualAvailableDates = this.filterAvailableDates(
        originalAvailableDates,
        bookedDates,
      );

      // Apply date filter if provided
      if (date || startDate || endDate) {
        const filterStart = date || startDate;
        const filterEnd = date || endDate;

        if (
          !this.matchesDateFilter(actualAvailableDates, filterStart, filterEnd)
        ) {
          return null; // Exclude this accommodation from results
        }

        // Filter the available_dates array to only include dates within the range
        actualAvailableDates = actualAvailableDates.filter((item) => {
          // Handle both string dates and date objects {date, time, price}
          const dateStr = typeof item === "string" ? item : item?.date;
          const normalized = this.normalizeDate(dateStr);
          if (!normalized) return false;

          const normalizedStart = this.normalizeDate(filterStart);
          const normalizedEnd = this.normalizeDate(filterEnd);

          return normalized >= normalizedStart && normalized <= normalizedEnd;
        });

        // If no dates remain after filtering, exclude this accommodation
        if (actualAvailableDates.length === 0) {
          return null;
        }
      }

      return {
        ...accommodation.dataValues,
        available_dates: actualAvailableDates,
        available_dates_list: actualAvailableDates,
      };
    });

    // Filter out null entries (accommodations that didn't match the date filter)
    return processedAccommodations.filter(
      (accommodation) => accommodation !== null,
    );
  }

  /**
   * Apply booking-aware filtering to a single accommodation
   * @param {object} accommodation - Single accommodation object
   * @returns {object} Accommodation with actual available dates
   */
  async applyBookingAwareFilteringToSingle(accommodation) {
    const bookedDatesMap = await this.getAllBookedDatesGrouped([
      accommodation.accommodation_id,
    ]);
    const bookedDates = bookedDatesMap[accommodation.accommodation_id] || [];
    const originalAvailableDates = this.parseJSONField(
      accommodation.available_dates,
    );
    const actualAvailableDates = this.filterAvailableDates(
      originalAvailableDates,
      bookedDates,
    );

    return {
      ...accommodation.dataValues,
      available_dates: actualAvailableDates,
      available_dates_list: actualAvailableDates,
    };
  }

  /**
   * Safely parse JSON field
   * @param {any} field - Field that might be JSON string or already parsed
   * @returns {array} Parsed array or empty array
   */
  parseJSONField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === "string") {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Normalize date to YYYY-MM-DD format
   * @param {string|Date} dateInput - Date in various formats
   * @returns {string|null} Normalized date string or null
   */
  normalizeDate(dateInput) {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split("T")[0];
    } catch {
      return null;
    }
  }
}

// Export singleton instance
module.exports = new AccommodationService();
