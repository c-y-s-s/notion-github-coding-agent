import { describe, expect, it } from "vitest"; import { createHmac } from "node:crypto"; import { verifyGitHubSignature } from "./github";
describe("verifyGitHubSignature", () => { it("accepts a valid signature", () => { const body = '{"ok":true}'; const secret = "test"; const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`; expect(verifyGitHubSignature(body, sig, secret)).toBe(true); }); it("rejects invalid input", () => expect(verifyGitHubSignature("x", "sha256=bad", "secret")).toBe(false)); });

