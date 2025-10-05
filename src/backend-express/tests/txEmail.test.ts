import { describe, it, expect } from "vitest";
import { sanitizeEmails } from "../services/txEmail";

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
