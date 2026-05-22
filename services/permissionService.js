const Permission = require("../models/permissionModel");

class PermissionService {
  async getAllPermissions() {
    return Permission.findAll({
      order: [
        ["section", "ASC"],
        ["code", "ASC"],
      ],
    });
  }

  async getPermissionsByResource(resource) {
    return Permission.findAll({
      where: { resource },
      order: [["code", "ASC"]],
    });
  }
}

module.exports = new PermissionService();

// Add method to group permissions by section
PermissionService.prototype.getPermissionsBySection = async function() {
  const permissions = await this.getAllPermissions();
  const grouped = {};

  permissions.forEach((permission) => {
    if (!grouped[permission.section]) {
      grouped[permission.section] = [];
    }
    grouped[permission.section].push({
      id: permission.id,
      name: permission.name,
      code: permission.code,
      resource: permission.resource,
    });
  });

  return grouped;
};
