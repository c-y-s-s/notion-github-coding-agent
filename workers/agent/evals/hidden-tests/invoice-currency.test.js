import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "./currency.js";
import { renderInvoice } from "./invoice.js";

test("shared formatter and invoice honor currency", () => {
  assert.equal(formatMoney(50, "TWD"), "TWD 50.00");
  assert.equal(renderInvoice({ total: 50, currency: "TWD" }), "Invoice total: TWD 50.00");
  assert.equal(renderInvoice({ total: 25, currency: "USD" }), "Invoice total: USD 25.00");
});
