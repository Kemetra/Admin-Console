import { textField } from "@/lib/form-field";
import { describe, expect, test } from "vitest";

/**
 * RT-510 (Sonar S6551): form fields are read as text without ever stringifying
 * a File entry to "[object File]".
 */
describe("textField", () => {
  test("returns a text entry as given, including an empty one", () => {
    const form = new FormData();
    form.set("name", "Cairo");
    form.set("note", "");
    expect(textField(form, "name")).toBe("Cairo");
    expect(textField(form, "note", "fallback")).toBe("");
  });

  test("a missing field reads as empty, or as the fallback when given", () => {
    const form = new FormData();
    expect(textField(form, "name")).toBe("");
    expect(textField(form, "category", "credit_customer")).toBe("credit_customer");
  });

  test("a File entry reads as empty, never as [object File]", () => {
    const form = new FormData();
    form.set("name", new File(["x"], "x.txt"));
    expect(textField(form, "name")).toBe("");
    expect(textField(form, "name", "fallback")).toBe("fallback");
  });
});
