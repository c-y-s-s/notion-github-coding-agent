import test from "node:test";
import assert from "node:assert/strict";
import { remainingStock } from "./inventory.js";

test("stock never falls below zero", () => {
  assert.equal(remainingStock(10, 3), 7);
  assert.equal(remainingStock(3, 10), 0);
});
