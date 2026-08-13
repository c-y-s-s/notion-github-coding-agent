import test from "node:test";
import assert from "node:assert/strict";
import { paginate } from "./pagination.js";

test("returns a complete page", () => {
  const items = ["a", "b", "c", "d"];
  assert.deepEqual(paginate(items, 1, 2), ["a", "b"]);
  assert.deepEqual(paginate(items, 2, 2), ["c", "d"]);
});
