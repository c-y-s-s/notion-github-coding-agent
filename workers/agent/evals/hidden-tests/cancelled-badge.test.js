import test from "node:test";
import assert from "node:assert/strict";
import { statusTone } from "./status-badge.js";

test("cancelled is red without changing existing tones", () => {
  assert.equal(statusTone("cancelled"), "red");
  assert.equal(statusTone("failed"), "red");
  assert.equal(statusTone("succeeded"), "green");
});
