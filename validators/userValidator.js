const { createSchema, validate } = require("./schema");

/**
 * Shared field aliases – the frontend sends different key names
 * depending on the flow (legacy vs new).
 */
const USER_ALIASES = {
  name: ["full_name", "owner_full_name"],
  email: ["user_email", "email_address"],
};

/* ── Schemas ───────────────────────────────────────────────────── */

const createUserSchema = createSchema(
  (field) => ({
    username: field().string().required().min(3).trim().stripHtml(),
    email: field().string().required().email().trim().lowercase(),
    password: field().string().required().min(6),
    name: field().string().required().min(2).trim().stripHtml(),
  }),
  USER_ALIASES,
);

const updateUserSchema = createSchema(
  (field) => ({
    username: field().string().optional().min(3).trim().stripHtml(),
    email: field().string().optional().email().trim().lowercase(),
    password: field().string().optional().min(6),
    name: field().string().optional().min(2).trim().stripHtml(),
  }),
  USER_ALIASES,
);

/* ── Middleware exports ────────────────────────────────────────── */

module.exports = {
  validateCreateUser: validate(createUserSchema),
  validateUpdateUser: validate(updateUserSchema),
  createUserSchema,
  updateUserSchema,
};
