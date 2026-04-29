"use strict";

const bcrypt = require("bcrypt");
const { QueryTypes } = require("sequelize");
const db = require("../config/db");

async function run() {
  const hash = await bcrypt.hash("password123", 10);
  await db.query(
    "UPDATE users SET password = :hash WHERE username = :username",
    {
      replacements: { hash, username: "operator_seed" },
      type: QueryTypes.UPDATE,
    },
  );
  console.log("Password reset OK for operator_seed");
  db.close();
}

run().catch((e) => {
  console.error(e.message);
  db.close();
  process.exit(1);
});
