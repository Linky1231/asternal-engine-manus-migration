import { describe, expect, it } from "vitest";
import { getStorageNamespaceKey, storageNamespaceFor } from "../src/lib/engine/storage";

describe("editor storage namespaces", () => {
  it("uses anonymous namespace only without an authenticated owner", () => {
    expect(storageNamespaceFor(null)).toBe("anonymous");
    expect(storageNamespaceFor(undefined)).toBe("anonymous");
  });

  it("normalizes a Supabase user id into a stable account namespace", () => {
    expect(storageNamespaceFor(" user/abc.def ")).toBe("user_abc_def");
    expect(getStorageNamespaceKey("projects:index")).toContain("asternal:");
  });

  it("does not expose the raw email as a storage identity", () => {
    const namespace = storageNamespaceFor("user-id-123");
    expect(namespace).not.toContain("@");
    expect(namespace).not.toContain("example.com");
  });
});
