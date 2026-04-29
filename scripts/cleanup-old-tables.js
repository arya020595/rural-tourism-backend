"use strict";

const db = require("../config/db");

const OLD_TABLES = [
  "company",
  "activity_booking",
  "accommodation_booking",
  "activity_master_table",
  "accommodation_list",
];

async function run() {
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of OLD_TABLES) {
    await db.query(`DROP TABLE IF EXISTS \`${t}\``);
    console.log("Dropped:", t);
  }
  await db.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Done.");
  db.close();
}

run().catch((e) => {
  console.error(e.message);
  db.close();
  process.exit(1);
});
