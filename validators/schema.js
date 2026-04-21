/**
 * Declarative schema-based validation (dry-validation style).
 *
 * Usage:
 *   const schema = createSchema((field) => ({
 *     username: field().string().required().min(3),
 *     email:    field().string().required().email(),
 *     age:      field().number().optional().min(0),
 *   }));
 *
 *   const { data, errors } = schema.validate(req.body);
 */

/* ── Field builder ─────────────────────────────────────────────── */

class FieldBuilder {
  constructor() {
    this._rules = [];
    this._type = "string";
    this._optional = false;
    this._sanitizers = [];
  }

  /* ── Type declarations ── */

  string() {
    this._type = "string";
    return this;
  }

  number() {
    this._type = "number";
    return this;
  }

  /* ── Presence ── */

  required() {
    this._optional = false;
    return this;
  }

  optional() {
    this._optional = true;
    return this;
  }

  /* ── Rules (chainable) ── */

  min(n) {
    this._rules.push({
      name: "min",
      check: (v) => (this._type === "number" ? v >= n : String(v).length >= n),
      message: (label) =>
        this._type === "number"
          ? `${label} must be at least ${n}`
          : `${label} must be at least ${n} characters`,
    });
    return this;
  }

  max(n) {
    this._rules.push({
      name: "max",
      check: (v) => (this._type === "number" ? v <= n : String(v).length <= n),
      message: (label) =>
        this._type === "number"
          ? `${label} must be at most ${n}`
          : `${label} must be at most ${n} characters`,
    });
    return this;
  }

  pattern(regex, msg) {
    this._rules.push({
      name: "pattern",
      check: (v) => regex.test(String(v)),
      message: (label) => msg || `${label} has invalid format`,
    });
    return this;
  }

  email() {
    return this.pattern(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "Valid email is required",
    );
  }

  /* ── Sanitizers ── */

  trim() {
    this._sanitizers.push((v) => (typeof v === "string" ? v.trim() : v));
    return this;
  }

  lowercase() {
    this._sanitizers.push((v) => (typeof v === "string" ? v.toLowerCase() : v));
    return this;
  }

  stripHtml() {
    this._sanitizers.push((v) =>
      typeof v === "string" ? v.replace(/[<>]/g, "") : v,
    );
    return this;
  }

  /* ── Internal: run validation on a single value ── */

  _validate(value, label) {
    const errors = [];

    const isBlank =
      value === undefined || value === null || String(value).trim() === "";

    if (isBlank) {
      if (!this._optional) {
        errors.push(`${label} is required`);
      }
      return { errors, value };
    }

    let coerced = value;
    if (this._type === "number") {
      coerced = Number(value);
      if (Number.isNaN(coerced)) {
        errors.push(`${label} must be a number`);
        return { errors, value };
      }
    } else {
      coerced = String(value);
    }

    for (const rule of this._rules) {
      if (!rule.check(coerced)) {
        errors.push(rule.message(label));
      }
    }

    // Apply sanitizers only when valid
    if (errors.length === 0) {
      for (const fn of this._sanitizers) {
        coerced = fn(coerced);
      }
    }

    return { errors, value: coerced };
  }
}

/* ── Schema ────────────────────────────────────────────────────── */

class Schema {
  /**
   * @param {Record<string, FieldBuilder>} fields
   * @param {Record<string, string[]>} [aliases] – maps canonical key → alternate body keys
   */
  constructor(fields, aliases = {}) {
    this._fields = fields;
    this._aliases = aliases;
  }

  /**
   * Validate a plain object (typically req.body).
   *
   * @param {object} input
   * @returns {{ data: object, errors: string[] }}
   *   `data` contains sanitized values (only present keys for optional fields).
   *   `errors` is empty when valid.
   */
  validate(input) {
    const errors = [];
    const data = {};

    for (const [key, builder] of Object.entries(this._fields)) {
      // Resolve value: try canonical key first, then aliases
      let rawValue = input[key];
      if (rawValue === undefined && this._aliases[key]) {
        for (const alias of this._aliases[key]) {
          if (input[alias] !== undefined) {
            rawValue = input[alias];
            break;
          }
        }
      }

      // Skip truly absent optional fields
      if (rawValue === undefined && builder._optional) {
        continue;
      }

      const label = key.replace(/_/g, " ");
      const result = builder._validate(rawValue, label);
      errors.push(...result.errors);

      if (result.errors.length === 0 && rawValue !== undefined) {
        data[key] = result.value;
      }
    }

    return { data, errors };
  }
}

/* ── Factory ───────────────────────────────────────────────────── */

/**
 * Create a Schema from a declarative definition.
 *
 * @param {(field: () => FieldBuilder) => Record<string, FieldBuilder>} defFn
 * @param {Record<string, string[]>} [aliases]
 * @returns {Schema}
 */
function createSchema(defFn, aliases = {}) {
  const field = () => new FieldBuilder();
  const fields = defFn(field);
  return new Schema(fields, aliases);
}

/**
 * Express middleware factory: validates req.body against a schema.
 *
 * @param {Schema} schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const { data, errors } = schema.validate(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Merge sanitized data back into req.body
    Object.assign(req.body, data);
    next();
  };
}

module.exports = { createSchema, validate, Schema, FieldBuilder };
