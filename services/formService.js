/**
 * Form Service
 * Single Responsibility: Handle all business logic for form_responses
 * Dependency Inversion: Depends on abstractions (models) injected or imported
 */

const FormResponse = require("../models/formModel");
const TouristUser = require("../models/touristModel");
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
    // Validate tourist exists
    await this.validateTouristExists(data.tourist_user_id);

    // Resolve activity_id from operator_activity_id if needed
    const resolvedActivityId = await this.resolveActivityId(
      data.activity_id,
      data.operator_activity_id,
    );

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
      activity_booking_id: data.activity_booking_id,
      accommodation_booking_id: data.accommodation_booking_id,
    };

    // Create and return the form
    const newForm = await FormResponse.create(formData);

    // Delegate booking status update to BookingService (SOLID: Single Responsibility)
    if (data.activity_booking_id) {
      await bookingService.markActivityBookingAsPaid(data.activity_booking_id);
    }
    if (data.accommodation_booking_id) {
      await bookingService.markAccommodationBookingAsPaid(
        data.accommodation_booking_id,
      );
    }

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
