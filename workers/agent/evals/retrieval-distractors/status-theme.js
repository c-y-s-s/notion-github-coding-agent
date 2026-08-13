export const statusTheme = { cancelled: "gray", failed: "red", succeeded: "green" };
export function previewStatusBadge(status) { return statusTheme[status] ?? "gray"; }
