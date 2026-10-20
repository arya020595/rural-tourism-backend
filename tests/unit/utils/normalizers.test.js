const { normalizeWallClockDate } = require("../../../utils/normalizers");

describe("normalizeWallClockDate (activity_date stored 'as typed')", () => {
  test.each([
    ["2026-01-04T18:54:00", "2026-01-04T18:54:00.000Z"],
    ["2026-01-04 18:54:00", "2026-01-04T18:54:00.000Z"],
    ["2026-01-04T18:54", "2026-01-04T18:54:00.000Z"],
    ["2026-01-04", "2026-01-04T00:00:00.000Z"],
  ])("keeps %s as typed", (input, expected) => {
    expect(normalizeWallClockDate(input).toISOString()).toBe(expected);
  });

  test("keeps values that already carry a timezone", () => {
    expect(normalizeWallClockDate("2026-01-04T18:54:00.000Z").toISOString()).toBe(
      "2026-01-04T18:54:00.000Z",
    );
    expect(normalizeWallClockDate("2026-01-04T18:54:00+08:00").toISOString()).toBe(
      "2026-01-04T10:54:00.000Z",
    );
  });

  test("an evening booking stays on its own day (regression: 4 Jan 6:54 PM showed on 5 Jan)", () => {
    const stored = normalizeWallClockDate("2026-01-04T18:54:00");
    expect(stored.toISOString().slice(0, 10)).toBe("2026-01-04");
  });

  test.each([[""], [null], [undefined], ["not a date"]])(
    "returns null for %p",
    (input) => {
      expect(normalizeWallClockDate(input)).toBeNull();
    },
  );
});
