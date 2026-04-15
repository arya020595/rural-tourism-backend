const sequelize = require("../config/db");

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

const run = async () => {
  const tableCheck = await sequelize.query("SHOW TABLES LIKE 'rt_users'", {
    type: sequelize.QueryTypes.SELECT,
  });

  if (!tableCheck.length) {
    throw new Error("rt_users table not found in current database.");
  }

  const rtUsersRows = await sequelize.query(
    `SELECT username, email_address
     FROM rt_users
     ORDER BY user_id ASC`,
    {
      type: sequelize.QueryTypes.SELECT,
    },
  );

  const usernames = [
    ...new Set(
      rtUsersRows.map((r) => normalizeText(r.username)).filter(Boolean),
    ),
  ];

  const emails = [
    ...new Set(
      rtUsersRows.map((r) => normalizeText(r.email_address)).filter(Boolean),
    ),
  ];

  if (!usernames.length) {
    console.log("No rt_users records found. Nothing to verify.");
    return;
  }

  const sqlUserCount = rtUsersRows.length;

  const users = await sequelize.query(
    `SELECT id, username, email, company_id
     FROM users
     WHERE username IN (:usernames) OR email IN (:emails)`,
    {
      replacements: { usernames, emails },
      type: sequelize.QueryTypes.SELECT,
    },
  );

  const userCompanyIds = [
    ...new Set(users.map((u) => Number(u.company_id)).filter(Boolean)),
  ];

  let companyCount = 0;
  if (userCompanyIds.length > 0) {
    const companyRows = await sequelize.query(
      `SELECT id
       FROM company
       WHERE id IN (:companyIds)`,
      {
        replacements: { companyIds: userCompanyIds },
        type: sequelize.QueryTypes.SELECT,
      },
    );
    companyCount = companyRows.length;
  }

  const existingUsernames = new Set(users.map((u) => String(u.username)));
  const missingUsernames = usernames.filter(
    (username) => !existingUsernames.has(username),
  );

  console.log(
    JSON.stringify(
      {
        sql_rows: sqlUserCount,
        sql_unique_usernames: usernames.length,
        db_users_matched_by_username_or_email: users.length,
        db_companies_linked_from_matched_users: companyCount,
        missing_usernames_count: missingUsernames.length,
        missing_usernames: missingUsernames,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
