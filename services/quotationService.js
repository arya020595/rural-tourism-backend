const { Op, fn, col, literal } = require("sequelize");
const sequelize = require("../config/db");
const Quotation = require("../models/quotationModel");
const QuotationItem = require("../models/quotationItemModel");
const Company = require("../models/companyModel");
const Product = require("../models/productModel");
const Booking = require("../models/bookingModel");
const bookingsService = require("./bookingsService");
const { policyScope } = require("../policies");
const { readAsBase64DataUri } = require("../utils/fileStorage");
const {
  normalizeString,
  normalizeInt,
  normalizeNumber,
  normalizeDateOnly,
} = require("../utils/normalizers");
const {
  OPEN_STATUSES,
  DEFAULT_VALIDITY_DAYS,
  malaysiaToday,
  malaysiaDayStart,
  addDays,
  daysBetween,
  quotationNo,
  parseQuotationNo,
  dateOnlyOf,
  effectiveStatus,
} = require("../utils/quotationHelpers");
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} = require("./errors/AppError");

const CITIZENSHIPS = ["domestic", "international", "both"];
const PRODUCT_TYPES = ["activity", "accommodation"];
const LIST_STATUSES = ["all", "sent", "accepted", "expired", "cancelled"];
const MAX_ITEMS = 30;
const MAX_TERMS_LENGTH = 5000;
const MAX_NOTES_LENGTH = MAX_TERMS_LENGTH;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OWN_PRODUCT_REQUIRED =
  "Sekurang-kurangnya satu item mesti produk syarikat anda / At least one item must be your company's product.";

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/** A pax count: empty → 0, otherwise a whole number ≥ 0 ("abc", 2.5, -1 → null). */
function paxCount(value) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

/**
 * A real calendar day as YYYY-MM-DD, or null. Stricter than new Date():
 * "2026-02-30" is refused instead of rolling over to 2 March.
 */
function strictDateOnly(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const ok = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return ok ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

class QuotationService {
  /* ── Reads ─────────────────────────────────────────────────────────── */

  async list(query = {}, user) {
    const page = Math.max(normalizeInt(query.page, 1) || 1, 1);
    const perPage = Math.min(Math.max(normalizeInt(query.per_page, 10) || 10, 1), 100);
    const today = malaysiaToday();

    const baseWhere = { ...policyScope("quotation", user) };
    const search = normalizeString(query.search);
    if (search) {
      const searchedId = parseQuotationNo(search);
      baseWhere[Op.or] = [
        { customerName: { [Op.like]: `%${search}%` } },
        { phoneNumber: { [Op.like]: `%${search}%` } },
        ...(searchedId ? [{ id: searchedId }] : []),
      ];
    }

    // Created date range (Malaysia days, both ends included).
    const createdFrom = this.parseDateFilter(query.created_from, "created_from");
    const createdTo = this.parseDateFilter(query.created_to, "created_to");
    if (createdFrom && createdTo && createdTo < createdFrom) {
      throw new BadRequestError("created_to must be on or after created_from.");
    }
    if (createdFrom || createdTo) {
      baseWhere.created_at = {
        ...(createdFrom ? { [Op.gte]: malaysiaDayStart(createdFrom) } : {}),
        ...(createdTo ? { [Op.lt]: malaysiaDayStart(addDays(createdTo, 1)) } : {}),
      };
    }

    const status = normalizeString(query.status).toLowerCase() || "all";
    if (!LIST_STATUSES.includes(status)) {
      throw new BadRequestError(`status must be one of: ${LIST_STATUSES.join(", ")}`);
    }

    const where = { ...baseWhere, ...this.statusWhere(status, today) };

    const { count, rows } = await Quotation.findAndCountAll({
      where,
      // Newest created first (the list shows the created date).
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    return {
      rows,
      counts: await this.countByStatus(baseWhere, today),
      pagination: { total: count, page, perPage, pages: Math.ceil(count / perPage) },
    };
  }

  /** YYYY-MM-DD or empty → string / null; anything else → 400. */
  parseDateFilter(value, name) {
    const text = normalizeString(value);
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
      throw new BadRequestError(`${name} must be a date (YYYY-MM-DD).`);
    }
    return text;
  }

  /** Extra `where` for a list status filter; expired is computed. */
  statusWhere(status, today) {
    switch (status) {
      case "sent":
        return { status, validUntil: { [Op.gte]: today } };
      case "expired":
        return { status: { [Op.in]: OPEN_STATUSES }, validUntil: { [Op.lt]: today } };
      case "accepted":
      case "cancelled":
        return { status };
      default:
        return {};
    }
  }

  /** Number of quotations per (effective) status, for the filter chips. */
  async countByStatus(baseWhere, today) {
    const effective = literal(
      `CASE WHEN status = 'sent' AND valid_until < ${sequelize.escape(today)} ` +
        `THEN 'expired' ELSE status END`,
    );
    const rows = await Quotation.findAll({
      attributes: [
        [effective, "effective_status"],
        [fn("COUNT", col("id")), "total"],
      ],
      where: baseWhere,
      group: [effective],
      raw: true,
    });

    const counts = { all: 0, sent: 0, accepted: 0, expired: 0, cancelled: 0 };
    rows.forEach((row) => {
      const total = Number(row.total || 0);
      counts[row.effective_status] = total;
      counts.all += total;
    });
    return counts;
  }

  /** Quotation with its items and linked booking (id, status). */
  async getById(id, transaction = null) {
    const quotationId = normalizeInt(id, null);
    if (quotationId === null) throw new BadRequestError("Invalid quotation id");

    const record = await Quotation.findByPk(quotationId, {
      include: [
        { model: QuotationItem, as: "items", required: false },
        { model: Booking, as: "booking", required: false, attributes: ["id", "status"] },
        { model: Company, as: "company", required: false, attributes: ["id", "company_name"] },
      ],
      order: [[{ model: QuotationItem, as: "items" }, "sortOrder", "ASC"]],
      transaction,
    });
    if (!record) throw new NotFoundError("Quotation not found.");
    return record;
  }

  /* ── Writes ────────────────────────────────────────────────────────── */

  async create(data, user) {
    const operator = await bookingsService.resolveOperatorContext(user);
    if (!operator.companyId) {
      throw new BadRequestError("Quotations are made from an operator account with a company.");
    }

    const transaction = await sequelize.transaction();
    try {
      const { fields, items } = await this.normalizeInput(data, operator.companyId, transaction);
      const quotation = await Quotation.create(
        {
          ...fields,
          companyId: operator.companyId,
          createdBy: operator.userId,
          // There is no draft: once saved it is shared with the customer.
          status: "sent",
          sentAt: new Date(),
        },
        { transaction },
      );
      await QuotationItem.bulkCreate(
        items.map((item) => ({ ...item, quotationId: quotation.id })),
        { transaction },
      );
      await transaction.commit();
      return this.getById(quotation.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /** Sent quotations (incl. expired) stay editable; items are replaced. */
  async update(id, data) {
    const transaction = await sequelize.transaction();
    try {
      const record = await this.lockForUpdate(id, transaction);
      if (!OPEN_STATUSES.includes(record.status)) {
        throw new BadRequestError(
          "Sebut harga ini tidak boleh diubah lagi / This quotation can no longer be edited.",
        );
      }

      const { fields, items } = await this.normalizeInput(data, record.companyId, transaction);
      await record.update(fields, { transaction });
      await QuotationItem.destroy({ where: { quotationId: record.id }, transaction });
      await QuotationItem.bulkCreate(
        items.map((item) => ({ ...item, quotationId: record.id })),
        { transaction },
      );
      await transaction.commit();
      return this.getById(record.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancel(id) {
    const transaction = await sequelize.transaction();
    try {
      const record = await this.lockForUpdate(id, transaction);
      if (!OPEN_STATUSES.includes(record.status)) {
        throw new BadRequestError("Only sent quotations can be cancelled.");
      }
      await record.update({ status: "cancelled", cancelledAt: new Date() }, { transaction });
      await transaction.commit();
      return this.getById(record.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async lockForUpdate(id, transaction) {
    const quotationId = normalizeInt(id, null);
    if (quotationId === null) throw new BadRequestError("Invalid quotation id");
    const record = await Quotation.findByPk(quotationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record) throw new NotFoundError("Quotation not found.");
    return record;
  }

  /* ── Input rules ───────────────────────────────────────────────────── */

  /**
   * Validates and normalises a create/update body. `ownCompanyId` is the
   * quotation's company: at least one item must be its product, and every
   * other company must be in the same association (as for package bookings).
   */
  async normalizeInput(data = {}, ownCompanyId, transaction = null) {
    const customerName = normalizeString(data.customer_name);
    if (!customerName) throw new BadRequestError("customer_name is required.");
    if (customerName.length > 255) throw new BadRequestError("customer_name is too long.");

    const phoneNumber = normalizeString(data.phone_number);
    if (phoneNumber.replace(/\D/g, "").length < 8) {
      throw new BadRequestError(
        "Sila masukkan no. telefon yang sah / Please enter a valid telephone number.",
      );
    }

    const email = normalizeString(data.email) || null;
    if (email && !EMAIL_PATTERN.test(email)) {
      throw new BadRequestError("Please enter a valid email address.");
    }

    const citizenship = normalizeString(data.citizenship).toLowerCase() || "domestic";
    if (!CITIZENSHIPS.includes(citizenship)) {
      throw new BadRequestError(`citizenship must be one of: ${CITIZENSHIPS.join(", ")}`);
    }

    const paxDomestik = paxCount(data.no_of_pax_domestik);
    const paxAntarbangsa = paxCount(data.no_of_pax_antarbangsa);
    if (paxDomestik === null || paxAntarbangsa === null) {
      throw new BadRequestError("Pax must be whole numbers of 0 or more.");
    }
    if (paxDomestik + paxAntarbangsa < 1) {
      throw new BadRequestError("Number of pax must be at least 1.");
    }

    const quotationDate = data.quotation_date
      ? strictDateOnly(data.quotation_date)
      : malaysiaToday();
    if (!quotationDate) throw new BadRequestError("quotation_date is not a valid date.");
    const validUntil = data.valid_until
      ? strictDateOnly(data.valid_until)
      : addDays(quotationDate, DEFAULT_VALIDITY_DAYS);
    if (!validUntil) throw new BadRequestError("valid_until is not a valid date.");
    if (validUntil < quotationDate) {
      throw new BadRequestError("valid_until must be on or after the quotation date.");
    }

    const notes = normalizeString(data.notes);
    if (notes.length > MAX_NOTES_LENGTH) {
      throw new BadRequestError(`Notes & terms can be at most ${MAX_NOTES_LENGTH} characters.`);
    }

    const items = await this.normalizeItems(data.items, ownCompanyId, transaction);
    const totalAmount = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));

    return {
      fields: {
        customerName,
        phoneNumber,
        email,
        citizenship,
        noOfPaxDomestik: paxDomestik,
        noOfPaxAntarbangsa: paxAntarbangsa,
        quotationDate,
        validUntil,
        notes: notes || null,
        // Typed on the form, like Operator Name on bookings (optional).
        preparedByName: normalizeString(data.prepared_by_name).slice(0, 255) || null,
        totalAmount,
      },
      items,
    };
  }

  async normalizeItems(rawItems, ownCompanyId, transaction = null) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadRequestError("Add at least one item.");
    }
    if (rawItems.length > MAX_ITEMS) {
      throw new BadRequestError(`A quotation can have at most ${MAX_ITEMS} items.`);
    }

    const parsed = rawItems.map((raw, index) => {
      const label = `Item ${index + 1}`;
      const productType = normalizeString(raw?.product_type).toLowerCase();
      if (!PRODUCT_TYPES.includes(productType)) {
        throw new BadRequestError(`${label}: product_type must be 'activity' or 'accommodation'.`);
      }
      const companyId = normalizeInt(raw?.company_id, null);
      if (companyId === null) throw new BadRequestError(`${label}: company is required.`);
      const productId = normalizeInt(raw?.product_id, null);
      if (productId === null) throw new BadRequestError(`${label}: service is required.`);
      const amount = normalizeNumber(raw?.amount, null);
      if (amount === null || amount <= 0) {
        throw new BadRequestError(`${label}: price must be greater than 0.`);
      }

      // Real calendar days only (the shared normaliser rolls 30 Feb over).
      for (const key of ["activity_date", "check_in_date", "check_out_date"]) {
        if (raw?.[key] && !strictDateOnly(raw[key])) {
          throw new BadRequestError(`${label}: ${key} is not a valid date.`);
        }
      }

      let dates;
      try {
        dates = bookingsService.normalizePackageItemDates({ ...raw, product_type: productType });
      } catch (error) {
        throw new BadRequestError(`${label}: ${error.message}`);
      }
      if (productType === "activity" && !dates.activityDate) {
        throw new BadRequestError(`${label}: activity date is required.`);
      }
      if (productType === "accommodation" && (!dates.checkInDate || !dates.checkOutDate)) {
        throw new BadRequestError(`${label}: start and end date are required.`);
      }

      return {
        sortOrder: index,
        productType,
        companyId,
        productId,
        amount: roundMoney(amount),
        activityDate: dates.activityDate,
        checkInDate: dates.checkInDate,
        checkOutDate: dates.checkOutDate,
      };
    });

    if (!parsed.some((item) => item.companyId === Number(ownCompanyId))) {
      throw new BadRequestError(OWN_PRODUCT_REQUIRED);
    }

    const companyIds = [...new Set(parsed.map((item) => item.companyId))];
    const companies = await Company.findAll({
      where: { id: companyIds },
      attributes: ["id", "company_name"],
      transaction,
    });
    const companyById = new Map(companies.map((company) => [company.id, company]));

    const products = await Product.findAll({
      where: { id: [...new Set(parsed.map((item) => item.productId))] },
      attributes: ["id", "company_id", "name", "product_type", "is_active"],
      transaction,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    // Other companies must be in our association (same rule as package items).
    const otherCompanyIds = companyIds.filter((id) => id !== Number(ownCompanyId));
    if (otherCompanyIds.length > 0) {
      const ownAssociationId = await bookingsService.resolveCompanyAssociationId(
        ownCompanyId,
        transaction,
      );
      for (const companyId of otherCompanyIds) {
        const associationId = await bookingsService.resolveCompanyAssociationId(
          companyId,
          transaction,
        );
        if (associationId !== ownAssociationId) {
          throw new BadRequestError(
            `${companyById.get(companyId)?.company_name || `Company ${companyId}`} is not in your association.`,
          );
        }
      }
    }

    return parsed.map((item, index) => {
      const label = `Item ${index + 1}`;
      const company = companyById.get(item.companyId);
      if (!company) throw new BadRequestError(`${label}: company not found.`);
      const product = productById.get(item.productId);
      if (!product || Number(product.company_id) !== item.companyId) {
        throw new BadRequestError(`${label}: service not found for this company.`);
      }
      if (product.product_type !== item.productType) {
        throw new BadRequestError(`${label}: the service is not an ${item.productType} product.`);
      }
      if (!product.is_active) {
        throw new BadRequestError(`${label}: ${product.name} is no longer active.`);
      }
      return {
        ...item,
        companyName: normalizeString(company.company_name) || null,
        description: normalizeString(product.name),
      };
    });
  }

  /* ── Company default notes & terms ─────────────────────────────────── */

  /** The user's company's saved default (null = use the standard text). */
  async getCompanyTerms(user) {
    const companyId = await this.requireCompanyId(user);
    const company = await Company.findByPk(companyId, { attributes: ["id", "quotation_terms"] });
    if (!company) throw new NotFoundError("Company not found.");
    return { terms: company.quotation_terms || null };
  }

  /** Saves the default for the user's company; empty text clears it. */
  async saveCompanyTerms(user, terms) {
    const companyId = await this.requireCompanyId(user);
    const text = normalizeString(terms);
    if (text.length > MAX_TERMS_LENGTH) {
      throw new BadRequestError(`Notes & terms can be at most ${MAX_TERMS_LENGTH} characters.`);
    }
    const company = await Company.findByPk(companyId);
    if (!company) throw new NotFoundError("Company not found.");
    await company.update({ quotation_terms: text || null });
    return { terms: text || null };
  }

  async requireCompanyId(user) {
    const operator = await bookingsService.resolveOperatorContext(user);
    if (!operator.companyId) {
      throw new BadRequestError("Quotations are made from an operator account with a company.");
    }
    return operator.companyId;
  }

  /* ── PDF ───────────────────────────────────────────────────────────── */

  async getPdfData(id) {
    const record = await this.getById(id);
    const company = await Company.findByPk(record.companyId, {
      attributes: ["company_name", "address", "location", "postcode", "contact_no", "email", "operator_logo_image"],
    });

    return {
      id: record.id,
      companyId: record.companyId,
      quotationNo: quotationNo(record.id),
      status: effectiveStatus(record),
      quotationDate: dateOnlyOf(record.quotationDate),
      validUntil: dateOnlyOf(record.validUntil),
      validityDays: daysBetween(dateOnlyOf(record.quotationDate), dateOnlyOf(record.validUntil)),
      preparedByName: record.preparedByName,
      customerName: record.customerName,
      phoneNumber: record.phoneNumber,
      email: record.email,
      paxDomestik: Number(record.noOfPaxDomestik || 0),
      paxAntarbangsa: Number(record.noOfPaxAntarbangsa || 0),
      notes: record.notes,
      totalAmount: Number(record.totalAmount || 0),
      items: (record.items || []).map((item) => ({
        description: item.description,
        productType: item.productType,
        companyName: item.companyName,
        isOwn: Number(item.companyId) === Number(record.companyId),
        amount: Number(item.amount || 0),
        activityDate: item.activityDate,
        checkInDate: item.checkInDate,
        checkOutDate: item.checkOutDate,
      })),
      company: {
        name: company?.company_name || "",
        address: company?.address || "",
        location: company?.location || "",
        postcode: company?.postcode || "",
        phone: company?.contact_no || "",
        email: company?.email || "",
        logoBase64: company ? readAsBase64DataUri(company.operator_logo_image) : null,
      },
    };
  }

  /* ── Conversion ────────────────────────────────────────────────────── */

  /**
   * The quotation as a booking record (same shape as GET /api/bookings/:id) for
   * the Add Booking (mode "booking") or E-Receipt (mode "receipt") form to
   * pre-fill. Nothing is saved here — the booking is created by the normal
   * POST /api/bookings with quotation_id (see bookingsService.createBooking).
   */
  buildBookingDraft(record, mode = "booking") {
    const status = effectiveStatus(record);
    if (status === "expired") {
      throw new ConflictError(
        "Sebut harga ini telah tamat tempoh — lanjutkan tarikh sah dahulu / This quotation has expired — extend its valid-until date first.",
      );
    }
    if (!OPEN_STATUSES.includes(record.status)) {
      throw new ConflictError(
        "Sebut harga ini sudah ditukar atau dibatalkan / This quotation was already converted or cancelled.",
      );
    }

    const items = [...(record.items || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const common = {
      id: null,
      quotation_id: record.id,
      quotation_no: quotationNo(record.id),
      mode,
      customer_type: "tourist",
      tourist_full_name: record.customerName,
      phone_number: record.phoneNumber,
      email: record.email || "",
      citizenship: record.citizenship,
      no_of_pax_domestik: Number(record.noOfPaxDomestik || 0),
      no_of_pax_antarbangsa: Number(record.noOfPaxAntarbangsa || 0),
      total_deposit: 0,
      // Operator Name on the booking form starts as the quotation's Prepared By.
      operator_name: record.preparedByName || "",
      status: mode === "receipt" ? "paid" : "booked",
    };

    // A one-item quotation is always our own product (enforced on save), so
    // it is a plain activity / accommodation booking.
    if (items.length === 1) {
      const [item] = items;
      if (item.productType === "activity") {
        return {
          ...common,
          booking_type: "activity",
          product_id: item.productId,
          product_name: item.description,
          activity_date: item.activityDate,
          total_price: Number(item.amount),
          package_companies: [],
        };
      }
      return {
        ...common,
        booking_type: "accommodation",
        product_id: item.productId,
        product_name: item.description,
        check_in_date: dateOnlyOf(item.checkInDate),
        check_out_date: dateOnlyOf(item.checkOutDate),
        total_of_night: daysBetween(dateOnlyOf(item.checkInDate), dateOnlyOf(item.checkOutDate)),
        total_price: Number(item.amount),
        package_companies: [],
      };
    }

    return {
      ...common,
      booking_type: "package",
      product_name: "Package",
      total_price: Number(record.totalAmount),
      package_companies: items.map((item) => ({
        referrer_id: record.companyId,
        referee_id: item.companyId,
        referee_company: item.companyName,
        description: item.description,
        per_price: Number(item.amount),
        product_type: item.productType,
        activity_date: item.activityDate,
        check_in_date: dateOnlyOf(item.checkInDate),
        check_out_date: dateOnlyOf(item.checkOutDate),
      })),
    };
  }

  /**
   * Called inside bookingsService.createBooking's transaction when the request
   * carries quotation_id: locks the quotation and checks it can still be
   * converted. The caller links it after creating the booking.
   */
  async lockForConversion(quotationId, actorContext, transaction) {
    const record = await Quotation.findByPk(quotationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record) throw new NotFoundError("Quotation not found.");
    if (
      !actorContext.isSuperadmin &&
      Number(record.companyId) !== Number(actorContext.companyId)
    ) {
      throw new ForbiddenError("This quotation belongs to another company.");
    }
    // Expiry is not re-checked here: the operator converted it while valid,
    // and an offline booking may sync later.
    if (!OPEN_STATUSES.includes(record.status) || record.bookingId) {
      throw new ConflictError(
        "Sebut harga ini sudah ditukar atau dibatalkan / This quotation was already converted or cancelled.",
      );
    }
    return record;
  }

  async markAccepted(record, bookingId, transaction) {
    await record.update(
      { status: "accepted", bookingId, acceptedAt: new Date() },
      { transaction },
    );
  }

  /** "QT_0007" for a booking made from a quotation, else null. */
  async quotationNoForBooking(bookingId) {
    if (!bookingId) return null;
    const record = await Quotation.findOne({ where: { bookingId }, attributes: ["id"] });
    return record ? quotationNo(record.id) : null;
  }
}

module.exports = new QuotationService();
