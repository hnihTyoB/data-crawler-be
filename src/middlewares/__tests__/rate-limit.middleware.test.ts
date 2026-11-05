import { Request, Response, NextFunction } from "express";

describe("rate-limit middleware Security Patches (SEC-30)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("logs security alert in production when Redis store is unavailable (SEC-30)", () => {
    process.env.NODE_ENV = "production";
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    jest.isolateModules(() => {
      require("../rate-limit.middleware");
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ALERT][Security] Redis rate limit store unavailable"),
    );
  });
});
