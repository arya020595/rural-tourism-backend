"use strict";

/**
 * Updates association `name` values from their short codes to their full
 * official names (with the short code retained in parentheses).
 *
 * Maps: shortCode -> fullName
 * The `up` only renames rows that still hold the short code, so it is safe to
 * re-run. The `down` reverses it back to the short codes.
 */
const NAME_MAP = [
  { code: "KATA", full: "PERSATUAN PELANCONGAN KADAMAIAN SABAH (KATA)" },
  { code: "KOBETA", full: "KOTA BELUD TOURISM ASSOCIATION (KOBETA)" },
  { code: "NTA", full: "NABALU TOURISM ASSOCIATION (NTA)" },
  { code: "RATA", full: "RANAU TOURISM ASSOCIATION (RATA)" },
  { code: "USTA", full: "PERSATUAN PELANCONGAN ULU SUGUT (USTA)" },
  {
    code: "KOMTDA",
    full: "KOTA MARUDU TOURISM DEVELOPMENT ASSOCIATION (KOMTDA)",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const { code, full } of NAME_MAP) {
      await queryInterface.sequelize.query(
        `
          UPDATE associations
          SET name = :full
          WHERE name = :code
            AND deleted_at IS NULL
        `,
        { replacements: { full, code } },
      );
    }
  },

  async down(queryInterface) {
    for (const { code, full } of NAME_MAP) {
      await queryInterface.sequelize.query(
        `
          UPDATE associations
          SET name = :code
          WHERE name = :full
            AND deleted_at IS NULL
        `,
        { replacements: { full, code } },
      );
    }
  },
};
