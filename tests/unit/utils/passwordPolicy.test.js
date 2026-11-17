const {
  MIN_PASSWORD_LENGTH,
  assertPasswordLength,
} = require("../../../utils/passwordPolicy");
const { BadRequestError } = require("../../../services/errors/AppError");

describe("passwordPolicy", () => {
  test("minimum length is 8", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  test.each([["abcdefgh"], ["12345678"], ["a much longer password"]])(
    "accepts %p",
    (password) => {
      expect(() => assertPasswordLength(password)).not.toThrow();
    },
  );

  test.each([[""], [null], [undefined], ["abc"], ["1234567"]])(
    "rejects %p with a 400",
    (password) => {
      expect(() => assertPasswordLength(password)).toThrow(BadRequestError);
      expect(() => assertPasswordLength(password)).toThrow(
        "Password must be at least 8 characters.",
      );
    },
  );

  test("uses the given label in the message", () => {
    expect(() => assertPasswordLength("short", "New password")).toThrow(
      "New password must be at least 8 characters.",
    );
  });
});
