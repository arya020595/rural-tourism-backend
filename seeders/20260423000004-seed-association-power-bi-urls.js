"use strict";

/**
 * Seeds sample power_bi_url values for existing associations.
 * Replace the placeholder URLs with actual Power BI embed URLs.
 */
const ASSOCIATION_POWER_BI_URLS = {
  KOBETA:
    "https://app.powerbi.com/reportEmbed?reportId=KOBETA_REPORT_ID&autoAuth=true&ctid=TENANT_ID",
  RATA: "https://app.powerbi.com/reportEmbed?reportId=RATA_REPORT_ID&autoAuth=true&ctid=TENANT_ID",
  KOMTDA:
    "https://app.powerbi.com/reportEmbed?reportId=KOMTDA_REPORT_ID&autoAuth=true&ctid=TENANT_ID",
  USTA: "https://app.powerbi.com/reportEmbed?reportId=USTA_REPORT_ID&autoAuth=true&ctid=TENANT_ID",
  NTA: "https://app.powerbi.com/reportEmbed?reportId=NTA_REPORT_ID&autoAuth=true&ctid=TENANT_ID",
  KATA: "https://app.powerbi.com/reportEmbed?reportId=KATA_REPORT_ID&autoAuth=true&ctid=TENANT_ID",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const [name, powerBiUrl] of Object.entries(
      ASSOCIATION_POWER_BI_URLS,
    )) {
      await queryInterface.sequelize.query(
        `
          UPDATE associations
          SET power_bi_url = :powerBiUrl
          WHERE name = :name
            AND deleted_at IS NULL
            AND power_bi_url IS NULL
        `,
        { replacements: { powerBiUrl, name } },
      );
    }
  },

  async down(queryInterface) {
    for (const [name, powerBiUrl] of Object.entries(
      ASSOCIATION_POWER_BI_URLS,
    )) {
      await queryInterface.sequelize.query(
        `
          UPDATE associations
          SET power_bi_url = NULL
          WHERE name = :name
            AND power_bi_url = :powerBiUrl
            AND deleted_at IS NULL
        `,
        { replacements: { powerBiUrl, name } },
      );
    }
  },
};
