function serialize(record) {
  const plain = record.toJSON ? record.toJSON() : record;
  return {
    id: plain.id,
    name: plain.name,
    image: plain.image,
    power_bi_url: plain.power_bi_url || null,
  };
}

function serializeMany(records) {
  return records.map(serialize);
}

module.exports = { serialize, serializeMany };
