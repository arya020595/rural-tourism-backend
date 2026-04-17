/**
 * Form Service
 * Single Responsibility: Handle all business logic for form_responses
 * Dependency Inversion: Depends on abstractions (models) injected or imported
 */

const FormResponse = require("../models/formModel");
const TouristUser = require("../models/touristModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const { bookingService } = require("./bookingService");

/**
 * Custom error classes for better error handling
 */
class FormServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "FormServiceError";
    this.statusCode = statusCode;
  }
}

class NotFoundError extends FormServiceError {
  constructor(resource, identifier) {
    super(`${resource} not found with ID: ${identifier}`, 404);
    this.name = "NotFoundError";
  }
}

class ValidationError extends FormServiceError {
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

/**
 * FormService class
 * Handles all business logic for form operations
 */
class FormService {
  /**
   * Create a new form response
   * @param {object} data - Sanitized form data
   * @returns {Promise<object>} Created form response
   * @throws {NotFoundError} If tourist or activity not found
   */
  async createForm(data) {
    // Validate tourist exists (required for both guest and manual — manual uses registered tourist)
    await this.validateTouristExists(data.tourist_user_id);

    // Resolve activity_id from operator_activity_id if needed
    const resolvedActivityId = await this.resolveActivityId(
      data.activity_id,
      data.operator_activity_id,
    );

    // Track booking IDs — guest bookings link existing IDs; manual bookings create new ones
    let activityBookingId = data.activity_booking_id || null;
    let accommodationBookingId = data.accommodation_booking_id || null;

    if (data.booking_type === "manual") {
      // Manual booking: create the booking record now with status 'paid'
      if (data.operator_activity_id || resolvedActivityId) {
        const newBooking = await bookingService.createManualActivityBooking({
          tourist_user_id: data.tourist_user_id,
          activity_id: resolvedActivityId || data.activity_id,
          operator_activity_id: data.operator_activity_id,
          total_price: data.total_rm || 0,
          no_of_pax: data.pax || null,
          date: data.date || null,
          time: data.time || null,
          nationality: data.nationality || null,
          contact_name: data.contact_name || null,
          contact_phone: data.contact_phone || null,
        });
        activityBookingId = newBooking.id;
      } else if (data.homest_id) {
        const newBooking =
          await bookingService.createManualAccommodationBooking({
            tourist_user_id: data.tourist_user_id,
            accommodation_id: data.homest_id,
            check_in: data.date,
            check_out: data.check_out,
            total_no_of_nights: data.total_night || 1,
            total_price: data.total_rm || "0",
            no_of_pax: data.pax || null,
            contact_name: data.contact_name || data.issuer || "Operator",
            contact_phone: data.contact_phone || null,
            contact_email: data.contact_email || null,
            nationality: data.nationality || null,
          });
        accommodationBookingId = newBooking.id;
      }
    }

    // Build form data object
    const formData = {
      receipt_id: data.receipt_id,
      operator_user_id: data.operator_user_id,
      tourist_user_id: data.tourist_user_id,
      citizenship: data.citizenship,
      pax: data.pax,
      activity_name: data.activity_name,
      homest_name: data.homest_name,
      location: data.location,
      activity_id: resolvedActivityId,
      homest_id: data.homest_id,
      total_rm: data.total_rm,
      total_night: data.total_night,
      package: data.package,
      issuer: data.issuer,
      date: data.date,
      booking_type: data.booking_type || "guest",
      activity_booking_id: activityBookingId,
      accommodation_booking_id: accommodationBookingId,
    };

    // Create and return the form
    const newForm = await FormResponse.create(formData);

    // For guest bookings: mark existing booking as paid
    if (data.booking_type !== "manual") {
      if (activityBookingId) {
        await bookingService.markActivityBookingAsPaid(activityBookingId);
      }
      if (accommodationBookingId) {
        await bookingService.markAccommodationBookingAsPaid(
          accommodationBookingId,
        );
      }
    }
    // Manual bookings are already created with status 'paid'

    return newForm;
  }

  /**
   * Get form by receipt ID
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<object>} Form response with tourist info
   * @throws {NotFoundError} If form not found
   */
  async getFormByReceiptId(receiptId) {
    const form = await FormResponse.findOne({
      where: { receipt_id: receiptId },
      include: [
        {
          model: TouristUser,
          as: "tourist",
          attributes: ["tourist_user_id", "full_name", "email", "contact_no"],
        },
        {
          model: UnifiedUser,
          as: "operator",
          attributes: ["id", "name", "username", "email"],
          include: [
            {
              model: Company,
              as: "company",
              attributes: ["company_name", "operator_logo_image"],
              required: false,
            },
          ],
        },
      ],
    });

    if (!form) {
      throw new NotFoundError("Form", receiptId);
    }

    return form;
  }

  /**
   * Get all forms by operator ID
   * @param {number} operatorId - Operator user ID
   * @returns {Promise<array>} Array of form responses
   */
  async getFormsByOperator(operatorId) {
    return await FormResponse.findAll({
      where: { operator_user_id: operatorId },
      include: [
        {
          model: TouristUser,
          as: "tourist",
          attributes: ["tourist_user_id", "full_name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });
  }

  /**
   * Get all forms by tourist user ID
   * @param {number} touristId - Tourist user ID
   * @returns {Promise<array>} Array of form responses
   */
  async getFormsByTourist(touristId) {
    return await FormResponse.findAll({
      where: { tourist_user_id: touristId },
      include: [
        {
          model: TouristUser,
          as: "tourist",
          attributes: ["tourist_user_id", "full_name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });
  }

  /**
   * Validate that a tourist user exists
   * @param {number} touristUserId - Tourist user ID
   * @throws {NotFoundError} If tourist not found
   */
  async validateTouristExists(touristUserId) {
    const tourist = await TouristUser.findByPk(touristUserId);
    if (!tourist) {
      throw new NotFoundError("Tourist", touristUserId);
    }
    return tourist;
  }

  /**
   * Resolve the actual activity_id from operator_activity_id
   * Auto-detects whether the ID is an operator_activity or master_activity
   * @param {number|null} activityId - Could be operator_activity.id or master activity.id
   * @param {number|null} operatorActivityId - Explicit operator activity ID
   * @returns {Promise<number|null>} Resolved master activity_id
   */
  async resolveActivityId(activityId, operatorActivityId) {
    // If operator_activity_id is explicitly provided, get the master activity_id
    if (operatorActivityId) {
      const operatorActivity =
        await OperatorActivity.findByPk(operatorActivityId);
      if (operatorActivity) {
        return operatorActivity.activity_id;
      }
    }

    // If activityId is provided, check if it exists in master table
    if (activityId) {
      const masterActivity = await ActivityMasterData.findByPk(activityId);

      // If found in master table, return it
      if (masterActivity) {
        return activityId;
      }

      // If not found in master table, check if it's an operator_activity.id
      const operatorActivity = await OperatorActivity.findByPk(activityId);
      if (operatorActivity) {
        // Return the master activity_id from operator_activities
        return operatorActivity.activity_id;
      }
    }

    // Return null if nothing found
    return null;
  }
}

// Export singleton instance and classes
module.exports = {
  FormService,
  formService: new FormService(),
  FormServiceError,
  NotFoundError,
  ValidationError,
};
