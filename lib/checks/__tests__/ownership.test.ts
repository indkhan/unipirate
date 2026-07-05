import { describe, expect, it } from "vitest";

import {
  createOwnerToken,
  hashOwnerToken,
  ownerCookieName,
} from "../ownership";

describe("anonymous check ownership", () => {
  it("generates an unguessable URL-safe token", () => {
    const first = createOwnerToken();
    const second = createOwnerToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("stores a deterministic SHA-256 hash instead of the raw token", () => {
    const token = createOwnerToken();
    const hash = hashOwnerToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashOwnerToken(token)).toBe(hash);
  });

  it("uses a check-specific cookie name", () => {
    expect(ownerCookieName("check-id")).toBe(
      "unipirate-check-owner-check-id",
    );
  });
});

