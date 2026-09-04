import { registerSchema } from "../auth.validation";

describe("auth.validation - registerSchema", () => {
  const validPassword = "Password@123";

  it("accepts a standard @gmail.com email", () => {
    const data = {
      email: "testuser@gmail.com",
      password: validPassword,
      fullName: "Test User",
    };

    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts an uppercase or mixed-case @gmail.com email", () => {
    const data = {
      email: "Test.User@GMAIL.COM",
      password: validPassword,
    };

    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts a @gmail.com email with sub-addressing (+ tag)", () => {
    const data = {
      email: "test.user+tag@gmail.com",
      password: validPassword,
    };

    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects non-gmail domains", () => {
    const nonGmailEmails = [
      "user@yahoo.com",
      "user@hotmail.com",
      "user@outlook.com",
      "user@company.vn",
      "user@gmail.com.vn",
      "user@sub.gmail.com",
      "user@notgmail.com",
      "user@fakegmail.com",
    ];

    for (const email of nonGmailEmails) {
      const result = registerSchema.safeParse({
        email,
        password: validPassword,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map((e) => e.message);
        expect(errorMessages).toContain(
          "Email đăng ký bắt buộc phải là địa chỉ @gmail.com.",
        );
      }
    }
  });

  it("rejects empty email with appropriate message", () => {
    const result = registerSchema.safeParse({
      email: "",
      password: validPassword,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.errors.map((e) => e.message);
      expect(errorMessages).toContain("Vui lòng nhập email.");
    }
  });

  it("rejects malformed email format", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: validPassword,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.errors.map((e) => e.message);
      expect(errorMessages).toContain("Email không đúng định dạng.");
    }
  });
});
