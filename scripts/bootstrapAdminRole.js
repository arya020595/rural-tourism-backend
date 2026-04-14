const { Op } = require("sequelize");
const sequelize = require("../config/db");
const Role = require("../models/roleModel");
const UnifiedUser = require("../models/unifiedUserModel");
const TouristUser = require("../models/touristModel");
const AssociationUser = require("../models/associationUserModel");

const USER_TYPE_CONFIG = {
  operator: {
    model: UnifiedUser,
    idField: "id",
    usernameField: "username",
    emailField: "email",
    label: "users",
  },
  tourist: {
    model: TouristUser,
    idField: "tourist_user_id",
    usernameField: "username",
    emailField: "email",
    label: "tourist_users",
  },
  association: {
    model: AssociationUser,
    idField: "id",
    usernameField: "username",
    emailField: "user_email",
    label: "association_users",
  },
};

const parseArgs = (argv) => {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
};

const printUsage = () => {
  console.log("Usage:");
  console.log(
    "  node scripts/bootstrapAdminRole.js --user-type <operator|tourist|association> --user-id <id>",
  );
  console.log(
    "  node scripts/bootstrapAdminRole.js --user-type <operator|tourist|association> --username <value>",
  );
  console.log(
    "  node scripts/bootstrapAdminRole.js --user-type <operator|tourist|association> --email <value>",
  );
  console.log("Optional flags:");
  console.log("  --dry-run   Show target account without updating role_id");
};

const resolveLookupWhere = (args, config) => {
  if (args["user-id"] !== undefined) {
    const idValue = Number(args["user-id"]);
    if (Number.isNaN(idValue)) {
      throw new Error("--user-id must be a number");
    }

    return { [config.idField]: idValue };
  }

  if (args.username) {
    return { [config.usernameField]: args.username };
  }

  if (args.email) {
    return { [config.emailField]: args.email };
  }

  throw new Error(
    "You must provide one lookup key: --user-id, --username, or --email",
  );
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const userType = String(args["user-type"] || "").toLowerCase();
  const dryRun = Boolean(args["dry-run"]);

  const config = USER_TYPE_CONFIG[userType];
  if (!config) {
    printUsage();
    throw new Error(
      "Invalid --user-type. Allowed values: operator, tourist, association",
    );
  }

  const where = resolveLookupWhere(args, config);

  const adminRole = await Role.findOne({ where: { name: "admin" } });
  if (!adminRole) {
    throw new Error(
      "Admin role not found. Run RBAC role/permission seeders before bootstrapping admin.",
    );
  }

  const user = await config.model.findOne({
    where: {
      [Op.and]: [where],
    },
  });

  if (!user) {
    throw new Error(
      `No ${userType} account found in ${config.label} for the provided lookup criteria.`,
    );
  }

  const identity = {
    user_type: userType,
    table: config.label,
    id: user[config.idField],
    username: user[config.usernameField],
    email: user[config.emailField] || null,
    current_role_id: user.role_id || null,
    target_role_id: adminRole.id,
  };

  if (dryRun) {
    console.log("Dry run: no database updates were made.");
    console.log(JSON.stringify(identity, null, 2));
    return;
  }

  if (user.role_id === adminRole.id) {
    console.log("No-op: account is already assigned to admin role.");
    console.log(JSON.stringify(identity, null, 2));
    return;
  }

  user.role_id = adminRole.id;
  await user.save();

  console.log("Admin bootstrap completed.");
  console.log(
    JSON.stringify(
      {
        ...identity,
        previous_role_id: identity.current_role_id,
        current_role_id: adminRole.id,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(`RBAC admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
