"use strict";

const DEFAULT_PERMISSIONS = [
  {
    name: "Super Admin Access",
    code: "*:*",
    resource: "*",
    section: "System",
  },
  {
    name: "Create User",
    code: "user:create",
    resource: "user",
    section: "User Management",
  },
  {
    name: "View Users",
    code: "user:read",
    resource: "user",
    section: "User Management",
  },
  {
    name: "Update User",
    code: "user:update",
    resource: "user",
    section: "User Management",
  },
  {
    name: "Delete User",
    code: "user:delete",
    resource: "user",
    section: "User Management",
  },
  {
    name: "View Own Profile",
    code: "profile:read",
    resource: "profile",
    section: "Profile",
  },
  {
    name: "Update Own Profile",
    code: "profile:update",
    resource: "profile",
    section: "Profile",
  },
  {
    name: "Create Accommodation",
    code: "accommodation:create",
    resource: "accommodation",
    section: "Accommodation Management",
  },
  {
    name: "View Accommodations",
    code: "accommodation:read",
    resource: "accommodation",
    section: "Accommodation Management",
  },
  {
    name: "Update Accommodation",
    code: "accommodation:update",
    resource: "accommodation",
    section: "Accommodation Management",
  },
  {
    name: "Delete Accommodation",
    code: "accommodation:delete",
    resource: "accommodation",
    section: "Accommodation Management",
  },
  {
    name: "Create Activity",
    code: "activity:create",
    resource: "activity",
    section: "Activity Management",
  },
  {
    name: "View Activities",
    code: "activity:read",
    resource: "activity",
    section: "Activity Management",
  },
  {
    name: "Update Activity",
    code: "activity:update",
    resource: "activity",
    section: "Activity Management",
  },
  {
    name: "Delete Activity",
    code: "activity:delete",
    resource: "activity",
    section: "Activity Management",
  },
  {
    name: "Create Booking",
    code: "booking:create",
    resource: "booking",
    section: "Booking Management",
  },
  {
    name: "View Bookings",
    code: "booking:read",
    resource: "booking",
    section: "Booking Management",
  },
  {
    name: "Update Booking",
    code: "booking:update",
    resource: "booking",
    section: "Booking Management",
  },
  {
    name: "Cancel Booking",
    code: "booking:delete",
    resource: "booking",
    section: "Booking Management",
  },
  {
    name: "Create Receipt",
    code: "receipt:create",
    resource: "receipt",
    section: "Receipt Management",
  },
  {
    name: "View Receipts",
    code: "receipt:read",
    resource: "receipt",
    section: "Receipt Management",
  },
  {
    name: "View Association",
    code: "association:read",
    resource: "association",
    section: "Association Management",
  },
  {
    name: "Update Association",
    code: "association:update",
    resource: "association",
    section: "Association Management",
  },
  {
    name: "Manage Association Users",
    code: "association:manage_users",
    resource: "association",
    section: "Association Management",
  },
  {
    name: "View Roles",
    code: "role:read",
    resource: "role",
    section: "Role & Permission Management",
  },
  {
    name: "Update Roles",
    code: "role:update",
    resource: "role",
    section: "Role & Permission Management",
  },
  {
    name: "View Permissions",
    code: "permission:read",
    resource: "permission",
    section: "Role & Permission Management",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const permission of DEFAULT_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `
          INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
          VALUES (:name, :code, :resource, :section, :createdAt, :updatedAt)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            resource = VALUES(resource),
            section = VALUES(section),
            updated_at = VALUES(updated_at)
        `,
        {
          replacements: {
            ...permission,
            createdAt: now,
            updatedAt: now,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      "permissions",
      {
        code: DEFAULT_PERMISSIONS.map((permission) => permission.code),
      },
      {},
    );
  },
};
