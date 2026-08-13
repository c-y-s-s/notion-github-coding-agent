import { describe, expect, it } from "vitest";
import { serviceError } from "./errors";

describe("serviceError", () => {
  it("converts Supabase objects into readable Error instances", () => {
    const error = serviceError("讀取任務失敗", { code: "PGRST201", message: "Ambiguous relationship", details: null, hint: "Choose a foreign key" });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("讀取任務失敗 [PGRST201]");
    expect(error.message).toContain("Choose a foreign key");
  });
});
