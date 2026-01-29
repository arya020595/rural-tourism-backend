const ActivityBooking = require("../models/bookingActivityModel");
const { Op } = require("sequelize");

/**
 * OperatorActivityService
 * Handles all business logic related to operator activities and booking-aware filtering
 */
class OperatorActivityService {
  /**
   * Parse JSON field safely
   * @param {string|array} field - JSON string or array
   * @returns {array} Parsed array
   */
  parseJSONField(field) {
    if (!field) return [];
    try {
      return typeof field === "string" ? JSON.parse(field) : field;
    } catch {
      return [];
    }
  }

  /**
   * Fetch all booked slots grouped by operator_activity_id and date
   * Optimized to use a single query to avoid N+1 problem
   * @param {array} operatorActivityIds - Array of operator activity IDs
   * @returns {object} Grouped booked slots: { activityId: { date: [time1, time2] } }
   */
  async getAllBookedSlotsGrouped(operatorActivityIds) {
    try {
      if (!operatorActivityIds || operatorActivityIds.length === 0) {
        return {};
      }

      const bookings = await ActivityBooking.findAll({
        where: {
          operator_activity_id: { [Op.in]: operatorActivityIds },
          status: { [Op.in]: ["booked", "paid"] },
        },
        attributes: ["operator_activity_id", "date", "time"],
      });

      // Group bookings by operator_activity_id -> date -> time slots
      const grouped = {};
      bookings.forEach((booking) => {
        const activityId = booking.operator_activity_id;
        const date = booking.date;
        const time = booking.time;

        if (date && time) {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            const formattedDate = d.toISOString().split("T")[0];

            if (!grouped[activityId]) {
              grouped[activityId] = {};
            }
            if (!grouped[activityId][formattedDate]) {
              grouped[activityId][formattedDate] = [];
            }
            grouped[activityId][formattedDate].push(time);
          }
        }
      });

      return grouped;
    } catch (err) {
      console.error("Error fetching booked slots:", err);
      return {};
    }
  }

  /**
   * Normalize date string to YYYY-MM-DD format
   * @param {string} dateStr - Date string
   * @returns {string|null} Normalized date or null if invalid
   */
  normalizeDate(dateStr) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return null;
      }
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  }

  /**
   * Filter out fully booked dates from available dates
   * A date is excluded only when ALL time slots are booked
   * @param {array} availableDates - Array of available date slots
   * @param {object} bookedSlots - Booked slots grouped by date
   * @returns {array} Filtered available dates
   */
  filterAvailableDates(availableDates, bookedSlots) {
    if (!availableDates || !Array.isArray(availableDates)) return [];
    if (!bookedSlots || Object.keys(bookedSlots).length === 0)
      return availableDates;

    // Group available dates by date to count total slots per date
    const slotsPerDate = {};
    availableDates.forEach((slot) => {
      if (slot && slot.date) {
        const normalized = this.normalizeDate(slot.date);
        if (normalized) {
          if (!slotsPerDate[normalized]) {
            slotsPerDate[normalized] = [];
          }
          slotsPerDate[normalized].push(slot.time);
        }
      }
    });

    // Determine which dates are fully booked
    const fullyBookedDates = new Set();
    Object.keys(slotsPerDate).forEach((date) => {
      const totalSlots = slotsPerDate[date].length;
      const bookedSlotsForDate = bookedSlots[date] || [];

      // Check if all slots are booked
      const allSlotsBooked = slotsPerDate[date].every((availableTime) =>
        bookedSlotsForDate.includes(availableTime),
      );

      if (allSlotsBooked && totalSlots === bookedSlotsForDate.length) {
        fullyBookedDates.add(date);
      }
    });

    // Filter out slots for fully booked dates
    return availableDates.filter((slot) => {
      if (!slot || !slot.date) return false;
      const normalized = this.normalizeDate(slot.date);
      return normalized && !fullyBookedDates.has(normalized);
    });
  }

  /**
   * Check if activity matches date filter criteria
   * @param {array} actualAvailableDates - Array of available date slots
   * @param {string} filterStartDate - Start date filter
   * @param {string} filterEndDate - End date filter
   * @returns {boolean} True if activity matches filter
   */
  matchesDateFilter(actualAvailableDates, filterStartDate, filterEndDate) {
    if (!filterStartDate && !filterEndDate) return true;
    if (!actualAvailableDates || actualAvailableDates.length === 0)
      return false;

    const filterStart = filterStartDate ? new Date(filterStartDate) : null;
    const filterEnd = filterEndDate ? new Date(filterEndDate) : null;

    if (filterStart && isNaN(filterStart.getTime())) return true;
    if (filterEnd && isNaN(filterEnd.getTime())) return true;

    if (filterStart) filterStart.setHours(0, 0, 0, 0);
    if (filterEnd) filterEnd.setHours(23, 59, 59, 999);

    // Check if any actual available date falls within the filter range
    return actualAvailableDates.some((slot) => {
      if (!slot || !slot.date) return false;
      try {
        const availableDate = new Date(slot.date);
        if (isNaN(availableDate.getTime())) {
          return false;
        }
        availableDate.setHours(0, 0, 0, 0);

        if (filterStart && filterEnd) {
          return availableDate >= filterStart && availableDate <= filterEnd;
        } else if (filterStart) {
          return availableDate >= filterStart;
        } else if (filterEnd) {
          return availableDate <= filterEnd;
        }
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Apply booking-aware filtering to activities
   * @param {array} activities - Array of activities
   * @param {object} filters - Filter options { date, startDate, endDate }
   * @returns {array} Filtered activities with actual available dates
   */
  async applyBookingAwareFiltering(activities, filters = {}) {
    const { date, startDate, endDate } = filters;

    // Optimize: Fetch all bookings in ONE query
    const activityIds = activities.map((a) => a.id);
    const bookedSlotsMap = await this.getAllBookedSlotsGrouped(activityIds);

    // Process each activity with pre-fetched booking data
    const processedActivities = activities.map((activity) => {
      const bookedSlots = bookedSlotsMap[activity.id] || {};
      const originalAvailableDates = this.parseJSONField(
        activity.available_dates,
      );
      let actualAvailableDates = this.filterAvailableDates(
        originalAvailableDates,
        bookedSlots,
      );

      // Apply date filter if provided
      if (date || startDate || endDate) {
        const filterStart = date || startDate;
        const filterEnd = date || endDate;

        if (
          !this.matchesDateFilter(actualAvailableDates, filterStart, filterEnd)
        ) {
          return null; // Exclude this activity from results
        }

        // Filter the available_dates array to only include dates within the range
        actualAvailableDates = actualAvailableDates.filter((slot) => {
          if (!slot || !slot.date) return false;
          const slotDate = this.normalizeDate(slot.date);
          if (!slotDate) return false;

          const normalizedStart = this.normalizeDate(filterStart);
          const normalizedEnd = this.normalizeDate(filterEnd);

          return slotDate >= normalizedStart && slotDate <= normalizedEnd;
        });

        // If no dates remain after filtering, exclude this activity
        if (actualAvailableDates.length === 0) {
          return null;
        }
      }

      return {
        ...activity.dataValues,
        available_dates: actualAvailableDates,
        available_dates_list: actualAvailableDates,
      };
    });

    // Filter out null entries (activities that didn't match the date filter)
    return processedActivities.filter((activity) => activity !== null);
  }

  /**
   * Apply booking-aware filtering to a single activity
   * @param {object} activity - Single activity object
   * @returns {object} Activity with actual available dates
   */
  async applyBookingAwareFilteringToSingle(activity) {
    const bookedSlotsMap = await this.getAllBookedSlotsGrouped([activity.id]);
    const bookedSlots = bookedSlotsMap[activity.id] || {};
    const originalAvailableDates = this.parseJSONField(
      activity.available_dates,
    );
    const actualAvailableDates = this.filterAvailableDates(
      originalAvailableDates,
      bookedSlots,
    );

    return {
      ...activity.dataValues,
      available_dates: actualAvailableDates,
      available_dates_list: actualAvailableDates,
    };
  }
}

// Export singleton instance
module.exports = new OperatorActivityService();
