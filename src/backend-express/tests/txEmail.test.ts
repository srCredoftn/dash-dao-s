import { describe, it, expect } from "vitest";
import {
  sanitizeEmails,
  sendEmail,
  registerInvalidEmailReporter,
} from "../services/txEmail";

describe("sanitizeEmails", () => {
  it("deduplicates and normalizes valid addresses", () => {
    const { valid, invalid } = sanitizeEmails(
      [
        "User@example.com",
        "user@example.com",
        " other@domain.eu ",
        "invalid-email",
        "",
        undefined,
      ],
      { logInvalid: false },
    );

    expect(valid).toEqual(["user@example.com", "other@domain.eu"]);
    expect(invalid).toEqual(["invalid-email"]);
  });

  it("produces empty valid list when all addresses invalid", () => {
    const { valid, invalid } = sanitizeEmails(["bad", "stillbad"], {
      logInvalid: false,
    });

    expect(valid).toEqual([]);
    expect(invalid).toEqual(["bad", "stillbad"]);
  });
});

describe("invalid email reporter integration", () => {
  const originalDisable = process.env.SMTP_DISABLE;

  beforeAll(() => {
    process.env.SMTP_DISABLE = "true";
  });

  afterAll(() => {
    if (originalDisable === undefined) {
      delete process.env.SMTP_DISABLE;
    } else {
      process.env.SMTP_DISABLE = originalDisable;
    }
  });

  afterEach(() => {
    registerInvalidEmailReporter(null);
  });

  it("notifies registered reporter when invalid addresses detected", async () => {
    const reports: any[] = [];
    registerInvalidEmailReporter(async (report) => {
      reports.push(report);
    });

    await sendEmail(
      ["bad@", "valid@example.com", "also_bad"],
      "Test Subject",
      "Corps",
    );

    expect(reports).toHaveLength(1);
    expect(reports[0].invalid).toEqual(["bad@", "also_bad"]);
    expect(reports[0].stage).toBe("sendEmail");
    expect(reports[0].requestedCount).toBe(3);
    expect(reports[0].validCount).toBe(1);
  });
});
