const { Op } = require("sequelize");
const Booking = require("../models/bookingModel");
const BookingPackageCompany = require("../models/bookingPackageCompanyModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const {
  normalizeString,
  normalizeInt,
  normalizeNumber,
  normalizeNullableDate,
  normalizeDateOnly,
} = require("../utils/normalizers");

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

  async resolveOperatorContext(authUser) {
    if (!authUser) {
      const error = new Error("Unauthorized. Please login first.");
      error.statusCode = 401;
      throw error;
    }

    if (authUser.user_type && authUser.user_type !== "operator") {
      const error = new Error("Only operator accounts can create bookings.");
      error.statusCode = 403;
      throw error;
    }

    const operatorUserId = normalizeInt(
      authUser.unified_user_id ?? authUser.id ?? authUser.legacy_user_id,
      null,
    );

    if (operatorUserId === null) {
      const error = new Error("Invalid token payload: missing operator user id.");
      error.statusCode = 401;
      throw error;
    }

    const user = await UnifiedUser.findByPk(operatorUserId, {
      attributes: ["id", "name", "username", "company_id"],
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

  async resolveCompanySnapshot(companyId, fallbackName = "") {
    const normalizedCompanyId = normalizeInt(companyId, null);
    if (normalizedCompanyId === null) {
      const error = new Error("Company id must be an integer.");
      error.statusCode = 400;
      throw error;
    }

    const company = await Company.findByPk(normalizedCompanyId, {
      attributes: ["id", "company_name"],
    });

    if (!company) {
      const error = new Error(`Company with id ${normalizedCompanyId} not found.`);
      error.statusCode = 400;
      throw error;
    }

    return {
      id: normalizedCompanyId,
      name: normalizeString(fallbackName) || normalizeString(company.company_name),
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

  async normalizePackageCompanies(rawItems = []) {
    const items = Array.isArray(rawItems) ? rawItems : [];

    return Promise.all(
      items.map(async (item) => {
        const referrer = await this.resolveCompanySnapshot(
          item?.referrer_id,
          item?.referral_company,
        );
        const referee = await this.resolveCompanySnapshot(
          item?.referee_id,
          item?.referee_company,
        );

        const perPrice = normalizeNumber(item?.per_price, null);
        if (perPrice === null || perPrice < 0) {
          const error = new Error("per_price must be numeric and >= 0");
          error.statusCode = 400;
          throw error;
        }

        return {
          referrerId: referrer.id,
          referralCompany: referrer.name,
          refereeId: referee.id,
          refereeCompany: referee.name,
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
      if (productId === null) errors.push("product_id is required for activity booking");
      if (!productName) errors.push("product_name is required for activity booking");
      if (!activityDate) errors.push("activity_date is required for activity booking");
    }

    let normalizedStay = { checkInDate: null, checkOutDate: null, totalOfNight: null };
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
      normalizedStay = { checkInDate: null, checkOutDate: null, totalOfNight: null };
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
        const error = new Error("no_of_pax_antarbangsa must be an integer >= 0");
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
      if (data.product_id !== null && data.product_id !== "" && value === null) {
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
      if (data.total_price !== null && data.total_price !== "" && (value === null || value < 0)) {
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
      if (data.check_out_date !== null && data.check_out_date !== "" && !value) {
        const error = new Error("check_out_date must be a valid date");
        error.statusCode = 400;
        throw error;
      }
      payload.checkOutDate = value || null;
    }

    if (data.total_of_night !== undefined) {
      const value = normalizeInt(data.total_of_night, null);
      if (data.total_of_night !== null && data.total_of_night !== "" && (value === null || value < 0)) {
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
      if (data.receipt_created_at !== null && data.receipt_created_at !== "" && !value) {
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

  async createBooking(data, authUser) {
    const operatorContext = await this.resolveOperatorContext(authUser);
    const payload = this.buildCreatePayload(data, operatorContext);

    const packageCompaniesRaw = Array.isArray(data.package_companies)
      ? data.package_companies
      : [];

    if (payload.bookingType === "package" && packageCompaniesRaw.length === 0) {
      const error = new Error("package_companies is required for package booking");
      error.statusCode = 400;
      throw error;
    }

    const packageCompanies =
      payload.bookingType === "package"
        ? await this.normalizePackageCompanies(packageCompaniesRaw)
        : [];

    const transaction = await Booking.sequelize.transaction();
    try {
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

  async getBookings(query = {}) {
    const page = Math.max(1, normalizeInt(query.page, 1));
    const perPage = Math.max(1, Math.min(100, normalizeInt(query.per_page, 20)));
    const offset = (page - 1) * perPage;

    const where = {};

    if (query.booking_type) {
      where.bookingType = this.ensureBookingTypeAllowed(query.booking_type);
    }

    if (query.status) {
      where.status = this.ensureStatusAllowed(query.status);
    }

    if (query.user_id !== undefined) {
      const userId = normalizeInt(query.user_id, null);
      if (userId === null) {
        const error = new Error("user_id filter must be an integer");
        error.statusCode = 400;
        throw error;
      }
      where.userId = userId;
    }

    if (query.company_id !== undefined) {
      const companyId = normalizeInt(query.company_id, null);
      if (companyId === null) {
        const error = new Error("company_id filter must be an integer");
        error.statusCode = 400;
        throw error;
      }
      where.companyId = companyId;
    }

    if (query.search) {
      const search = String(query.search).trim();
      if (search) {
        where[Op.or] = [
          { touristFullName: { [Op.like]: `%${search}%` } },
          { productName: { [Op.like]: `%${search}%` } },
          { userFullname: { [Op.like]: `%${search}%` } },
          { operatorName: { [Op.like]: `%${search}%` } },
          { companyName: { [Op.like]: `%${search}%` } },
        ];
      }
    }

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
      totalCount: count,
      data: rows.map((row) => this.serialize(row)),
      pagination: {
        page,
        per_page: perPage,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
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

  async updateBooking(id, data) {
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

    const payload = this.buildUpdatePayload(data);

    const draft = {
      bookingType: payload.bookingType ?? record.bookingType,
      productId:
        payload.productId !== undefined ? payload.productId : record.productId,
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
      const incomingArray = hasPackageCompaniesInput ? packageCompaniesRaw : null;
      const nextCount = hasPackageCompaniesInput
        ? incomingArray.length
        : (record.package_companies || []).length;

      if (nextCount === 0) {
        errors.push("package booking must have at least 1 package_companies item");
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

    const transaction = await Booking.sequelize.transaction();
    try {
      await record.update(payload, { transaction });

      if (hasPackageCompaniesInput) {
        await BookingPackageCompany.destroy({
          where: { bookingPackageId: record.id },
          transaction,
        });

        if (packageCompaniesRaw.length > 0) {
          const normalized = await this.normalizePackageCompanies(packageCompaniesRaw);
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

    const record = await Booking.findByPk(bookingId);
    if (!record) {
      const error = new Error("Booking not found.");
      error.statusCode = 404;
      throw error;
    }

    const normalizedStatus = this.ensureStatusAllowed(status);
    await record.update({ status: normalizedStatus });

    return this.serialize(record);
  }

  async deleteBooking(id) {
    const bookingId = normalizeInt(id, null);
    if (bookingId === null) {
      const error = new Error("Invalid booking id");
      error.statusCode = 400;
      throw error;
    }

    const record = await Booking.findByPk(bookingId);
    if (!record) {
      const error = new Error("Booking not found.");
      error.statusCode = 404;
      throw error;
    }

    await record.destroy();
    return true;
  }
}

module.exports = new BookingsService();
