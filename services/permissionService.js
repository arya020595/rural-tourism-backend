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
