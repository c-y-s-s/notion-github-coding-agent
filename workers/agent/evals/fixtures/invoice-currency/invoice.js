import { formatMoney } from "./currency.js";

export function renderInvoice(invoice) {
  return `Invoice total: ${formatMoney(invoice.total)}`;
}
