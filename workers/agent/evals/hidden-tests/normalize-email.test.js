import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail } from "./normalize-email.js";

test("trims and lowercases email", () => {
  assert.equal(normalizeEmail("  USER@Example.COM  "), "user@example.com");
});
