/**
 * User serializer — converts Sequelize model instances
 * into a consistent API response shape.
 *
 * Pattern: Rails-style serializer (one file per resource).
 */

function serialize(user) {
  const plain = user.toJSON ? user.toJSON() : user;
  return {
    id: plain.id,
    name: plain.name,
    username: plain.username,
    email: plain.email,
    association_id: plain.association_id || null,
    role_id: plain.role_id || null,
    company_id: plain.company_id || null,
    role: plain.role || null,
    association: plain.association || null,
    company: plain.company || null,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

function serializeMany(users) {
  return users.map(serialize);
}

module.exports = { serialize, serializeMany };
