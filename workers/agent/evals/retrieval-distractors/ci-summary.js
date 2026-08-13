export function summarizeChecks(checks) { return checks.map(check => `${check.name}: ${check.status}`); }
