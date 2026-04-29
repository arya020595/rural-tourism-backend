/**
 * Association serializer.
 * Public responses include id/name/image; Power BI URL is restricted to authorized contexts.
 */
function serialize(record, options = {}) {
  const plain = record.toJSON ? record.toJSON() : record;
  const serialized = {
    id: plain.id,
    name: plain.name,
    image: plain.image,
  };

  if (options.includePowerBiUrl) {
    serialized.power_bi_url = plain.power_bi_url || null;
  }

  return serialized;
}

function serializeAuthorized(record) {
  return serialize(record, { includePowerBiUrl: true });
}

function serializeMany(records, options = {}) {
  return records.map((record) => serialize(record, options));
}

function serializeManyAuthorized(records) {
  return serializeMany(records, { includePowerBiUrl: true });
}

module.exports = {
  serialize,
  serializeAuthorized,
  serializeMany,
  serializeManyAuthorized,
};
