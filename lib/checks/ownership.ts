import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const COOKIE_PREFIX = "unipirate-check-owner-";

export function createOwnerToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashOwnerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function ownerCookieName(checkId: string): string {
  return `${COOKIE_PREFIX}${checkId}`;
}

