/**
 * Role serializer — converts Sequelize model instances
 * into a consistent API response shape.
 */

function serializePermission(p) {
  const plain = p.toJSON ? p.toJSON() : p;
  return {
    id: plain.id,
    name: plain.name,
    code: plain.code,
    resource: plain.resource,
    section: plain.section,
  };
}

/** Full role detail (includes permissions array) */
function serialize(role) {
  const plain = role.toJSON ? role.toJSON() : role;
  const permissions = Array.isArray(plain.permissions)
    ? plain.permissions.map(serializePermission)
    : [];
  return {
    id: plain.id,
    name: plain.name,
    permissions,
    permissions_count: permissions.length,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

/** List-optimised shape (no heavy permissions array) */
function serializeListItem(role) {
  const plain = role.toJSON ? role.toJSON() : role;
  return {
    id: plain.id,
    name: plain.name,
    permissions_count: Array.isArray(plain.permissions)
      ? plain.permissions.length
      : 0,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

function serializeMany(roles) {
  return roles.map(serializeListItem);
}

module.exports = { serialize, serializeMany };
