const { Op } = require("sequelize");
const Booking = require("../models/bookingModel");
const BookingPackageCompany = require("../models/bookingPackageCompanyModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const Product = require("../models/productModel");
const {
  normalizeString,
  normalizeInt,
  normalizeNumber,
  normalizeNullableDate,
  normalizeDateOnly,
} = require("../utils/normalizers");
const { buildMeta } = require("../utils/helpers");

const ALLOWED_STATUSES = [
  "pending",
  "booked",
  "confirmed",
  "paid",
  "cancelled",
  "completed",
  "rejected",
];

const ALLOWED_BOOKING_TYPES = ["activity", "accommodation", "package"];

class BookingsService {
  ensureStatusAllowed(status) {
    const normalizedStatus = normalizeString(status).toLowerCase();

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      const error = new Error(
        `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
      );
      error.statusCode = 400;
      throw error;
    }

    return normalizedStatus;
  }

  ensureBookingTypeAllowed(type) {
    const normalizedType = normalizeString(type).toLowerCase();

    if (!ALLOWED_BOOKING_TYPES.includes(normalizedType)) {
      const error = new Error(
        `Invalid booking_type. Allowed values: ${ALLOWED_BOOKING_TYPES.join(", ")}`,
      );
      error.statusCode = 400;
      throw error;
    }

    return normalizedType;
  }

  computeNightDiff(checkInDate, checkOutDate) {
    const start = new Date(`${checkInDate}T00:00:00.000Z`);
    const end = new Date(`${checkOutDate}T00:00:00.000Z`);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }

  validateStayFields(checkInDate, checkOutDate, totalOfNight, errors) {
    const hasAnyStayField =
      checkInDate !== null || checkOutDate !== null || totalOfNight !== null;

    if (!hasAnyStayField) {
      return { checkInDate: null, checkOutDate: null, totalOfNight: null };
    }

    if (!checkInDate) {
      errors.push("check_in_date is required when stay fields are provided");
    }

    if (!checkOutDate) {
      errors.push("check_out_date is required when stay fields are provided");
    }

    if (!checkInDate || !checkOutDate) {
      return { checkInDate, checkOutDate, totalOfNight };
    }

    const diffNights = this.computeNightDiff(checkInDate, checkOutDate);
    if (diffNights < 0) {
      errors.push("check_out_date must be on or after check_in_date");
      return { checkInDate, checkOutDate, totalOfNight };
    }

    if (totalOfNight === null) {
      return { checkInDate, checkOutDate, totalOfNight: diffNights };
    }

    if (totalOfNight < 0) {
      errors.push("total_of_night must be an integer >= 0");
      return { checkInDate, checkOutDate, totalOfNight };
    }

    if (totalOfNight !== diffNights) {
      errors.push(
        "total_of_night must match difference between check_in_date and check_out_date",
      );
    }

    return { checkInDate, checkOutDate, totalOfNight };
  }

  async resolveOperatorContext(authUser, transaction = null) {
    if (!authUser) {
      const error = new Error("Unauthorized. Please login first.");
      error.statusCode = 401;
      throw error;
    }

    const operatorUserId = normalizeInt(
      authUser.unified_user_id ?? authUser.id ?? authUser.legacy_user_id,
      null,
    );

    if (operatorUserId === null) {
      const error = new Error(
        "Invalid token payload: missing operator user id.",
      );
      error.statusCode = 401;
      throw error;
    }

    const user = await UnifiedUser.findByPk(operatorUserId, {
      attributes: ["id", "name", "username", "company_id"],
      transaction,
      include: [
        {
          model: Company,
          as: "company",
          required: false,
          attributes: ["id", "company_name"],
        },
      ],
    });

    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }

    const userFullname =
      normalizeString(user.name) || normalizeString(user.username) || null;

    if (!userFullname) {
      const error = new Error("Operator full name is missing.");
      error.statusCode = 400;
      throw error;
    }

    const companyId = normalizeInt(user.company_id, null);
    const companyName = normalizeString(user.company?.company_name) || null;

    return {
      userId: operatorUserId,
      userFullname,
      companyId,
      companyName,
    };
  }

  isSuperadmin(authUser) {
    return (
      authUser?.role === "superadmin" ||
      (Array.isArray(authUser?.permissions) &&
        authUser.permissions.includes("*:*"))
    );
  }

  async resolveActorContext(authUser, transaction = null) {
    const operatorContext = await this.resolveOperatorContext(
      authUser,
      transaction,
    );

    return {
      ...operatorContext,
      isSuperadmin: this.isSuperadmin(authUser),
    };
  }

  async validateProductAccess(productId, actorContext, transaction = null) {
    const normalizedProductId = normalizeInt(productId, null);
    if (normalizedProductId === null) {
      const error = new Error("product_id must be an integer");
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findByPk(normalizedProductId, {
      attributes: ["id", "company_id", "name"],
      transaction,
    });

    if (!product) {
      const error = new Error("Invalid product_id");
      error.statusCode = 400;
      throw error;
    }

    if (actorContext.isSuperadmin) {
      return product;
    }

    const operatorCompanyId = normalizeInt(actorContext.companyId, null);
    const productCompanyId = normalizeInt(product.company_id, null);

    if (
      operatorCompanyId === null ||
      productCompanyId === null ||
      operatorCompanyId !== productCompanyId
    ) {
      const error = new Error(
        "Forbidden. You can only process bookings for products in your own company.",
      );
      error.statusCode = 403;
      throw error;
    }

    return product;
  }

  async resolveCompanySnapshot(
    companyId,
    fallbackName = "",
    transaction = null,
  ) {
    const normalizedCompanyId = normalizeInt(companyId, null);
    if (normalizedCompanyId === null) {
      const error = new Error("Company id must be an integer.");
      error.statusCode = 400;
      throw error;
    }

    const company = await Company.findByPk(normalizedCompanyId, {
      attributes: ["id", "company_name"],
      transaction,
    });

    if (!company) {
      const error = new Error(
        `Company with id ${normalizedCompanyId} not found.`,
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      id: normalizedCompanyId,
      name:
        normalizeString(fallbackName) || normalizeString(company.company_name),
    };
  }

  serializePackageCompany(record) {
    return {
      id: record.id,
      booking_package_id: record.bookingPackageId,
      referrer_id: record.referrerId,
      referral_company: record.referralCompany,
      referee_id: record.refereeId,
      referee_company: record.refereeCompany,
      description: record.description,
      per_price: record.perPrice,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  serialize(record) {
    const packageCompanies = Array.isArray(record.package_companies)
      ? record.package_companies
      : [];

    return {
      id: record.id,
      booking_type: record.bookingType,
      tourist_full_name: record.touristFullName,
      citizenship: record.citizenship,
      no_of_pax_antarbangsa: record.noOfPaxAntarbangsa,
      no_of_pax_domestik: record.noOfPaxDomestik,
      total_pax:
        Number(record.noOfPaxAntarbangsa || 0) +
        Number(record.noOfPaxDomestik || 0),
      product_id: record.productId,
      product_name: record.productName,
      activity_date: record.activityDate,
      total_price: record.totalPrice,
      user_id: record.userId,
      user_fullname: record.userFullname,
      check_in_date: record.checkInDate,
      check_out_date: record.checkOutDate,
      total_of_night: record.totalOfNight,
      status: record.status,
      receipt_created_at: record.receiptCreatedAt,
      operator_name: record.operatorName,
      company_id: record.companyId,
      company_name: record.companyName,
      package_companies: packageCompanies.map((item) =>
        this.serializePackageCompany(item),
      ),
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  serializeBookingSummary(record) {
    return {
      id: record.id,
      booking_type: record.bookingType,
      tourist_full_name: record.touristFullName,
      citizenship: record.citizenship,
      no_of_pax_antarbangsa: record.noOfPaxAntarbangsa,
      no_of_pax_domestik: record.noOfPaxDomestik,
      total_pax:
        Number(record.noOfPaxAntarbangsa || 0) +
        Number(record.noOfPaxDomestik || 0),
      product_id: record.productId,
      product_name: record.productName,
      activity_date: record.activityDate,
      total_price: record.totalPrice,
      user_id: record.userId,
      user_fullname: record.userFullname,
      check_in_date: record.checkInDate,
      check_out_date: record.checkOutDate,
      total_of_night: record.totalOfNight,
      status: record.status,
      receipt_created_at: record.receiptCreatedAt,
      operator_name: record.operatorName,
      company_id: record.companyId,
      company_name: record.companyName,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async normalizePackageCompanies(rawItems = [], transaction = null) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    if (items.length === 0) return [];

    // Collect unique company IDs for both referrers and referees to avoid N+1 queries
    const companyIds = new Set();
    for (const item of items) {
      const referrerId = normalizeInt(item?.referrer_id, null);
      const refereeId = normalizeInt(item?.referee_id, null);
      if (referrerId !== null) companyIds.add(referrerId);
      if (refereeId !== null) companyIds.add(refereeId);
    }

    // Batch-fetch all needed companies in one query
    const companies = await Company.findAll({
      where: { id: [...companyIds] },
      attributes: ["id", "company_name"],
      transaction,
    });
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    return Promise.all(
      items.map(async (item) => {
        const referrerId = normalizeInt(item?.referrer_id, null);
        const refereeId = normalizeInt(item?.referee_id, null);

        if (referrerId === null) {
          const error = new Error("referrer_id must be an integer.");
          error.statusCode = 400;
          throw error;
        }
        if (refereeId === null) {
          const error = new Error("referee_id must be an integer.");
          error.statusCode = 400;
          throw error;
        }

        const referrerCompany = companyMap.get(referrerId);
        if (!referrerCompany) {
          const error = new Error(`Company with id ${referrerId} not found.`);
          error.statusCode = 400;
          throw error;
        }
        const refereeCompany = companyMap.get(refereeId);
        if (!refereeCompany) {
          const error = new Error(`Company with id ${refereeId} not found.`);
          error.statusCode = 400;
          throw error;
        }

        const perPrice = normalizeNumber(item?.per_price, null);
        if (perPrice === null || perPrice < 0) {
          const error = new Error("per_price must be numeric and >= 0");
          error.statusCode = 400;
          throw error;
        }

        return {
          referrerId,
          referralCompany:
            normalizeString(item?.referral_company) ||
            normalizeString(referrerCompany.company_name),
          refereeId,
          refereeCompany:
            normalizeString(item?.referee_company) ||
            normalizeString(refereeCompany.company_name),
          description: normalizeString(item?.description) || null,
          perPrice,
        };
      }),
    );
  }

  buildCreatePayload(data, operatorContext) {
    const bookingType = this.ensureBookingTypeAllowed(data.booking_type);
    const touristFullName = normalizeString(data.tourist_full_name) || null;
    const citizenship = normalizeString(data.citizenship) || null;
    const noOfPaxAntarbangsa = normalizeInt(data.no_of_pax_antarbangsa, null);
    const noOfPaxDomestik = normalizeInt(data.no_of_pax_domestik, null);
    const productId = normalizeInt(data.product_id, null);
    const productName = normalizeString(data.product_name) || null;
    const activityDate = normalizeNullableDate(data.activity_date);
    const totalPrice = normalizeNumber(data.total_price, null);
    const status = data.status
      ? this.ensureStatusAllowed(data.status)
      : "pending";
    const receiptCreatedAt = normalizeNullableDate(data.receipt_created_at);
    const operatorName = normalizeString(data.operator_name) || null;

    const checkInDate = normalizeDateOnly(data.check_in_date) || null;
    const checkOutDate = normalizeDateOnly(data.check_out_date) || null;
    const totalOfNight = normalizeInt(data.total_of_night, null);

    const errors = [];

    if (!touristFullName) errors.push("tourist_full_name is required");
    if (!citizenship) errors.push("citizenship is required");

    if (noOfPaxAntarbangsa === null || noOfPaxAntarbangsa < 0) {
      errors.push("no_of_pax_antarbangsa must be an integer >= 0");
    }

    if (noOfPaxDomestik === null || noOfPaxDomestik < 0) {
      errors.push("no_of_pax_domestik must be an integer >= 0");
    }

    if (totalPrice === null || totalPrice < 0) {
      errors.push("total_price must be numeric and >= 0");
    }

    if (bookingType === "activity") {
      if (productId === null)
        errors.push("product_id is required for activity booking");
      if (!productName)
        errors.push("product_name is required for activity booking");
      if (!activityDate)
        errors.push("activity_date is required for activity booking");
    }

    let normalizedStay = {
      checkInDate: null,
      checkOutDate: null,
      totalOfNight: null,
    };
    if (bookingType === "accommodation") {
      normalizedStay = this.validateStayFields(
        checkInDate,
        checkOutDate,
        totalOfNight,
        errors,
      );

      if (!normalizedStay.checkInDate) {
        errors.push("check_in_date is required for accommodation booking");
      }

      if (!normalizedStay.checkOutDate) {
        errors.push("check_out_date is required for accommodation booking");
      }

      if (productId === null) {
        errors.push("product_id is required for accommodation booking");
      }

      if (!productName) {
        errors.push("product_name is required for accommodation booking");
      }
    }

    if (bookingType === "package") {
      normalizedStay = {
        checkInDate: null,
        checkOutDate: null,
        totalOfNight: null,
      };
    }

    if (errors.length > 0) {
      const error = new Error("Validation failed");
      error.statusCode = 400;
      error.details = errors;
      throw error;
    }

    return {
      bookingType,
      touristFullName,
      citizenship,
      noOfPaxAntarbangsa,
      noOfPaxDomestik,
      productId,
      productName,
      activityDate,
      totalPrice,
      userId: operatorContext.userId,
      userFullname: operatorContext.userFullname,
      checkInDate: normalizedStay.checkInDate,
      checkOutDate: normalizedStay.checkOutDate,
      totalOfNight: normalizedStay.totalOfNight,
      status,
      receiptCreatedAt,
      operatorName,
      companyId: operatorContext.companyId,
      companyName: operatorContext.companyName,
    };
  }

  buildUpdatePayload(data) {
    const payload = {};

    if (data.booking_type !== undefined) {
      payload.bookingType = this.ensureBookingTypeAllowed(data.booking_type);
    }

    if (data.tourist_full_name !== undefined) {
      const value = normalizeString(data.tourist_full_name);
      if (!value) {
        const error = new Error("tourist_full_name cannot be empty");
        error.statusCode = 400;
        throw error;
      }
      payload.touristFullName = value;
    }

    if (data.citizenship !== undefined) {
      const value = normalizeString(data.citizenship);
      if (!value) {
        const error = new Error("citizenship cannot be empty");
        error.statusCode = 400;
        throw error;
      }
      payload.citizenship = value;
    }

    if (data.no_of_pax_antarbangsa !== undefined) {
      const value = normalizeInt(data.no_of_pax_antarbangsa, null);
      if (value === null || value < 0) {
        const error = new Error(
          "no_of_pax_antarbangsa must be an integer >= 0",
        );
        error.statusCode = 400;
        throw error;
      }
      payload.noOfPaxAntarbangsa = value;
    }

    if (data.no_of_pax_domestik !== undefined) {
      const value = normalizeInt(data.no_of_pax_domestik, null);
      if (value === null || value < 0) {
        const error = new Error("no_of_pax_domestik must be an integer >= 0");
        error.statusCode = 400;
        throw error;
      }
      payload.noOfPaxDomestik = value;
    }

    if (data.product_id !== undefined) {
      const value = normalizeInt(data.product_id, null);
      if (
        data.product_id !== null &&
        data.product_id !== "" &&
        value === null
      ) {
        const error = new Error("product_id must be an integer");
        error.statusCode = 400;
        throw error;
      }
      payload.productId = value;
    }

    if (data.product_name !== undefined) {
      payload.productName = normalizeString(data.product_name) || null;
    }

    if (data.activity_date !== undefined) {
      const value = normalizeNullableDate(data.activity_date);
      if (data.activity_date !== null && data.activity_date !== "" && !value) {
        const error = new Error("activity_date must be a valid timestamp");
        error.statusCode = 400;
        throw error;
      }
      payload.activityDate = value;
    }

    if (data.total_price !== undefined) {
      const value = normalizeNumber(data.total_price, null);
      if (
        data.total_price !== null &&
        data.total_price !== "" &&
        (value === null || value < 0)
      ) {
        const error = new Error("total_price must be numeric and >= 0");
        error.statusCode = 400;
        throw error;
      }
      payload.totalPrice = value;
    }

    if (data.check_in_date !== undefined) {
      const value = normalizeDateOnly(data.check_in_date);
      if (data.check_in_date !== null && data.check_in_date !== "" && !value) {
        const error = new Error("check_in_date must be a valid date");
        error.statusCode = 400;
        throw error;
      }
      payload.checkInDate = value || null;
    }

    if (data.check_out_date !== undefined) {
      const value = normalizeDateOnly(data.check_out_date);
      if (
        data.check_out_date !== null &&
        data.check_out_date !== "" &&
        !value
      ) {
        const error = new Error("check_out_date must be a valid date");
        error.statusCode = 400;
        throw error;
      }
      payload.checkOutDate = value || null;
    }

    if (data.total_of_night !== undefined) {
      const value = normalizeInt(data.total_of_night, null);
      if (
        data.total_of_night !== null &&
        data.total_of_night !== "" &&
        (value === null || value < 0)
      ) {
        const error = new Error("total_of_night must be an integer >= 0");
        error.statusCode = 400;
        throw error;
      }
      payload.totalOfNight = value;
    }

    if (data.status !== undefined) {
      payload.status = this.ensureStatusAllowed(data.status);
    }

    if (data.receipt_created_at !== undefined) {
      const value = normalizeNullableDate(data.receipt_created_at);
      if (
        data.receipt_created_at !== null &&
        data.receipt_created_at !== "" &&
        !value
      ) {
        const error = new Error("receipt_created_at must be a valid timestamp");
        error.statusCode = 400;
        throw error;
      }
      payload.receiptCreatedAt = value;
    }

    if (data.operator_name !== undefined) {
      payload.operatorName = normalizeString(data.operator_name) || null;
    }

    return payload;
  }

  validateTypeSpecificRules(bookingType, draft, errors) {
    if (bookingType === "activity") {
      if (draft.productId === null || draft.productId === undefined) {
        errors.push("product_id is required for activity booking");
      }

      if (!normalizeString(draft.productName)) {
        errors.push("product_name is required for activity booking");
      }

      if (!draft.activityDate) {
        errors.push("activity_date is required for activity booking");
      }
    }

    if (bookingType === "accommodation") {
      const normalizedStay = this.validateStayFields(
        draft.checkInDate,
        draft.checkOutDate,
        draft.totalOfNight,
        errors,
      );
      draft.checkInDate = normalizedStay.checkInDate;
      draft.checkOutDate = normalizedStay.checkOutDate;
      draft.totalOfNight = normalizedStay.totalOfNight;

      if (draft.productId === null || draft.productId === undefined) {
        errors.push("product_id is required for accommodation booking");
      }

      if (!normalizeString(draft.productName)) {
        errors.push("product_name is required for accommodation booking");
      }

      if (!draft.checkInDate) {
        errors.push("check_in_date is required for accommodation booking");
      }

      if (!draft.checkOutDate) {
        errors.push("check_out_date is required for accommodation booking");
      }
    }
  }

  validateCreateRequiredFieldsForDraft(draft, errors) {
    if (!normalizeString(draft.touristFullName)) {
      errors.push("tourist_full_name is required");
    }

    if (!normalizeString(draft.citizenship)) {
      errors.push("citizenship is required");
    }

    const paxAntarbangsa = normalizeInt(draft.noOfPaxAntarbangsa, null);
    if (paxAntarbangsa === null || paxAntarbangsa < 0) {
      errors.push("no_of_pax_antarbangsa must be an integer >= 0");
    }

    const paxDomestik = normalizeInt(draft.noOfPaxDomestik, null);
    if (paxDomestik === null || paxDomestik < 0) {
      errors.push("no_of_pax_domestik must be an integer >= 0");
    }

    const totalPrice = normalizeNumber(draft.totalPrice, null);
    if (totalPrice === null || totalPrice < 0) {
      errors.push("total_price must be numeric and >= 0");
    }
  }

  async createBooking(data, authUser) {
    const packageCompaniesRaw = Array.isArray(data.package_companies)
      ? data.package_companies
      : [];

    const transaction = await Booking.sequelize.transaction();
    try {
      const actorContext = await this.resolveActorContext(
        authUser,
        transaction,
      );
      const payload = this.buildCreatePayload(data, actorContext);

      if (
        payload.bookingType === "package" &&
        packageCompaniesRaw.length === 0
      ) {
        const error = new Error(
          "package_companies is required for package booking",
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        payload.bookingType === "activity" ||
        payload.bookingType === "accommodation"
      ) {
        await this.validateProductAccess(
          payload.productId,
          actorContext,
          transaction,
        );
      }

      const packageCompanies =
        payload.bookingType === "package"
          ? await this.normalizePackageCompanies(
              packageCompaniesRaw,
              transaction,
            )
          : [];

      const created = await Booking.create(payload, { transaction });

      if (packageCompanies.length > 0) {
        const rows = packageCompanies.map((item) => ({
          bookingPackageId: created.id,
          referrerId: item.referrerId,
          referralCompany: item.referralCompany,
          refereeId: item.refereeId,
          refereeCompany: item.refereeCompany,
          description: item.description,
          perPrice: item.perPrice,
        }));

        await BookingPackageCompany.bulkCreate(rows, { transaction });
      }

      await transaction.commit();

      const record = await Booking.findByPk(created.id, {
        include: [
          {
            model: BookingPackageCompany,
            as: "package_companies",
            required: false,
          },
        ],
      });

      return this.serialize(record);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getBookings(query = {}, authUser = null) {
    const page = Math.max(1, normalizeInt(query.page, 1));
    const perPage = Math.max(
      1,
      Math.min(100, normalizeInt(query.per_page, 20)),
    );
    const offset = (page - 1) * perPage;

    const queryWhere = {};

    if (query.booking_type) {
      queryWhere.bookingType = this.ensureBookingTypeAllowed(
        query.booking_type,
      );
    }

    if (query.status) {
      queryWhere.status = this.ensureStatusAllowed(query.status);
    }

    if (query.user_id !== undefined) {
      const userId = normalizeInt(query.user_id, null);
      if (userId === null) {
        const error = new Error("user_id filter must be an integer");
        error.statusCode = 400;
        throw error;
      }
      queryWhere.userId = userId;
    }

    const actorContext = authUser
      ? await this.resolveActorContext(authUser)
      : null;

    if (actorContext && !actorContext.isSuperadmin) {
      const actorCompanyId = normalizeInt(actorContext.companyId, null);
      if (actorCompanyId === null) {
        const error = new Error("Operator company context is missing.");
        error.statusCode = 403;
        throw error;
      }
      where.companyId = actorCompanyId;
    }

    if (query.search) {
      const search = String(query.search).trim();
      if (search) {
        queryWhere[Op.or] = [
          { touristFullName: { [Op.like]: `%${search}%` } },
          { productName: { [Op.like]: `%${search}%` } },
          { userFullname: { [Op.like]: `%${search}%` } },
          { operatorName: { [Op.like]: `%${search}%` } },
          { companyName: { [Op.like]: `%${search}%` } },
        ];
      }
    }

    // Policy scope always wins over query filters (prevents cross-tenant access)
    const where = { ...queryWhere, ...scope };

    const { count, rows } = await Booking.findAndCountAll({
      where,
      include: [
        {
          model: BookingPackageCompany,
          as: "package_companies",
          required: false,
        },
      ],
      order: [["id", "DESC"]],
      limit: perPage,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / perPage);

    return {
      data: rows.map((row) => this.serialize(row)),
      meta: buildMeta(count, page, perPage, totalPages),
    };
  }

  async getPackageBookings(query = {}, authUser = null) {
    const page = Math.max(1, normalizeInt(query.page, 1));
    const perPage = Math.max(1, Math.min(100, normalizeInt(query.per_page, 20)));
    const offset = (page - 1) * perPage;

    const where = {};
    const bookingWhere = { bookingType: "package" };
    if (query.status) {
      bookingWhere.status = this.ensureStatusAllowed(query.status);
    }

    const actorContext = authUser
      ? await this.resolveActorContext(authUser)
      : null;

    if (actorContext && !actorContext.isSuperadmin) {
      const actorCompanyId = normalizeInt(actorContext.companyId, null);
      if (actorCompanyId === null) {
        const error = new Error("Operator company context is missing.");
        error.statusCode = 403;
        throw error;
      }

      where[Op.or] = [
        { referrerId: actorCompanyId },
        { refereeId: actorCompanyId },
      ];
    }

    if (query.search) {
      const search = String(query.search).trim();
      if (search) {
        where[Op.and] = (where[Op.and] || []).concat({
          [Op.or]: [
            { referralCompany: { [Op.like]: `%${search}%` } },
            { refereeCompany: { [Op.like]: `%${search}%` } },
            { description: { [Op.like]: `%${search}%` } },
          ],
        });
      }
    }

    const { count, rows } = await BookingPackageCompany.findAndCountAll({
      where,
      include: [
        {
          model: Booking,
          as: "booking_package",
          required: true,
          where: bookingWhere,
        },
      ],
      order: [["id", "DESC"]],
      limit: perPage,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / perPage);

    return {
      data: rows.map((row) => ({
        ...this.serializePackageCompany(row),
        booking: this.serializeBookingSummary(row.booking_package),
      })),
      meta: buildMeta(count, page, perPage, totalPages),
    };
  }

  async getBookingById(id) {
    const bookingId = normalizeInt(id, null);
    if (bookingId === null) {
      const error = new Error("Invalid booking id");
      error.statusCode = 400;
      throw error;
    }

    const record = await Booking.findByPk(bookingId, {
      include: [
        {
          model: BookingPackageCompany,
          as: "package_companies",
          required: false,
        },
      ],
    });

    if (!record) {
      const error = new Error("Booking not found.");
      error.statusCode = 404;
      throw error;
    }

    return this.serialize(record);
  }

  async updateBooking(id, data, authUser) {
    const bookingId = normalizeInt(id, null);
    if (bookingId === null) {
      const error = new Error("Invalid booking id");
      error.statusCode = 400;
      throw error;
    }

    const transaction = await Booking.sequelize.transaction();
    try {
      const actorContext = await this.resolveActorContext(
        authUser,
        transaction,
      );

      const record = await Booking.findByPk(bookingId, {
        transaction,
        include: [
          {
            model: BookingPackageCompany,
            as: "package_companies",
            required: false,
          },
        ],
      });

      if (!record) {
        const error = new Error("Booking not found.");
        error.statusCode = 404;
        throw error;
      }

      const payload = this.buildUpdatePayload(data);

      const nextBookingType = payload.bookingType ?? record.bookingType;
      const isBookingTypeChanged =
        payload.bookingType !== undefined &&
        payload.bookingType !== record.bookingType;

      const draft = {
        bookingType: nextBookingType,
        touristFullName:
          payload.touristFullName !== undefined
            ? payload.touristFullName
            : record.touristFullName,
        citizenship:
          payload.citizenship !== undefined
            ? payload.citizenship
            : record.citizenship,
        noOfPaxAntarbangsa:
          payload.noOfPaxAntarbangsa !== undefined
            ? payload.noOfPaxAntarbangsa
            : record.noOfPaxAntarbangsa,
        noOfPaxDomestik:
          payload.noOfPaxDomestik !== undefined
            ? payload.noOfPaxDomestik
            : record.noOfPaxDomestik,
        totalPrice:
          payload.totalPrice !== undefined
            ? payload.totalPrice
            : record.totalPrice,
        productId:
          payload.productId !== undefined
            ? payload.productId
            : record.productId,
        productName:
          payload.productName !== undefined
            ? payload.productName
            : record.productName,
        activityDate:
          payload.activityDate !== undefined
            ? payload.activityDate
            : record.activityDate,
        checkInDate:
          payload.checkInDate !== undefined
            ? payload.checkInDate
            : record.checkInDate,
        checkOutDate:
          payload.checkOutDate !== undefined
            ? payload.checkOutDate
            : record.checkOutDate,
        totalOfNight:
          payload.totalOfNight !== undefined
            ? payload.totalOfNight
            : record.totalOfNight,
      };

      const errors = [];
      this.validateTypeSpecificRules(draft.bookingType, draft, errors);
      if (isBookingTypeChanged) {
        this.validateCreateRequiredFieldsForDraft(draft, errors);
      }

      if (
        draft.bookingType === "activity" ||
        draft.bookingType === "accommodation"
      ) {
        await this.validateProductAccess(
          draft.productId,
          actorContext,
          transaction,
        );
      }

      if (draft.bookingType === "activity") {
        payload.checkInDate = null;
        payload.checkOutDate = null;
        payload.totalOfNight = null;
      }

      if (draft.bookingType === "accommodation") {
        payload.activityDate = null;
        payload.checkInDate = draft.checkInDate;
        payload.checkOutDate = draft.checkOutDate;
        payload.totalOfNight = draft.totalOfNight;
      }

      if (draft.bookingType === "package") {
        payload.activityDate = null;
        payload.checkInDate = null;
        payload.checkOutDate = null;
        payload.totalOfNight = null;
        payload.productId = null;
        payload.productName = null;
      }

      const packageCompaniesRaw = data.package_companies;
      const hasPackageCompaniesInput = packageCompaniesRaw !== undefined;

      if (hasPackageCompaniesInput && !Array.isArray(packageCompaniesRaw)) {
        const error = new Error("package_companies must be an array");
        error.statusCode = 400;
        throw error;
      }

      if (draft.bookingType === "package") {
        const incomingArray = hasPackageCompaniesInput
          ? packageCompaniesRaw
          : null;
        const nextCount = hasPackageCompaniesInput
          ? incomingArray.length
          : (record.package_companies || []).length;

        if (nextCount === 0) {
          errors.push(
            "package booking must have at least 1 package_companies item",
          );
        }
      }

      if (Object.keys(payload).length === 0 && !hasPackageCompaniesInput) {
        const error = new Error("No valid fields provided for update");
        error.statusCode = 400;
        throw error;
      }

      if (errors.length > 0) {
        const error = new Error("Validation failed");
        error.statusCode = 400;
        error.details = errors;
        throw error;
      }

      await record.update(payload, { transaction });

      if (hasPackageCompaniesInput) {
        await BookingPackageCompany.destroy({
          where: { bookingPackageId: record.id },
          transaction,
        });

        if (packageCompaniesRaw.length > 0) {
          const normalized = await this.normalizePackageCompanies(
            packageCompaniesRaw,
            transaction,
          );
          await BookingPackageCompany.bulkCreate(
            normalized.map((item) => ({
              bookingPackageId: record.id,
              referrerId: item.referrerId,
              referralCompany: item.referralCompany,
              refereeId: item.refereeId,
              refereeCompany: item.refereeCompany,
              description: item.description,
              perPrice: item.perPrice,
            })),
            { transaction },
          );
        }
      } else if (draft.bookingType !== "package") {
        await BookingPackageCompany.destroy({
          where: { bookingPackageId: record.id },
          transaction,
        });
      }

      await transaction.commit();

      const refreshed = await Booking.findByPk(record.id, {
        include: [
          {
            model: BookingPackageCompany,
            as: "package_companies",
            required: false,
          },
        ],
      });

      return this.serialize(refreshed);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateBookingStatus(id, status) {
    const bookingId = normalizeInt(id, null);
    if (bookingId === null) {
      const error = new Error("Invalid booking id");
      error.statusCode = 400;
      throw error;
    }

    const transaction = await Booking.sequelize.transaction();
    try {
      const record = await Booking.findByPk(bookingId, { transaction });
      if (!record) {
        const error = new Error("Booking not found.");
        error.statusCode = 404;
        throw error;
      }

      const normalizedStatus = this.ensureStatusAllowed(status);
      await record.update({ status: normalizedStatus }, { transaction });
      await transaction.commit();

      return this.serialize(record);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteBooking(id) {
    const bookingId = normalizeInt(id, null);
    if (bookingId === null) {
      const error = new Error("Invalid booking id");
      error.statusCode = 400;
      throw error;
    }

    const transaction = await Booking.sequelize.transaction();
    try {
      const record = await Booking.findByPk(bookingId, { transaction });
      if (!record) {
        const error = new Error("Booking not found.");
        error.statusCode = 404;
        throw error;
      }

      await record.destroy({ transaction });
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new BookingsService();
