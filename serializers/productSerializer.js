/**
 * Product serializer — converts Sequelize model instances
 * into a consistent API response shape.
 *
 * Pattern: Rails-style serializer (one file per resource).
 */

function serialize(product) {
  const plain = product.toJSON ? product.toJSON() : product;
  return {
    id: plain.id,
    name: plain.name,
    product_type: plain.product_type,
    company_id: plain.company_id,
    company: plain.company || null,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

function serializeMany(products) {
  return products.map(serialize);
}

module.exports = { serialize, serializeMany };
