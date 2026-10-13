import { describe, it, expect } from "vitest";
import { errorDetails } from "./api-errors.mjs";
describe("structured error classifications", () => {
  it("distinguishes unexpected errors, storage errors and declared validation errors", () => {
    expect(errorDetails(new TypeError("Unexpected failure")).statusCode).toBe(500);
    expect(
      errorDetails(Object.assign(new Error("Disk error"), { code: "ENOSPC" })).statusCode,
    ).toBe(500);
    expect(
      errorDetails(
        Object.assign(new Error("Translated"), {
          statusCode: 400,
          code: "VALIDATION_ERROR",
          field: "support.email",
        }),
      ),
    ).toMatchObject({ statusCode: 400, field: "support.email" });
  });
});
