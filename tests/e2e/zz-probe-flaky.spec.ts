import { expect, test } from "@playwright/test";

// RT-584 PROBE ONLY (throwaway draft PR, never merged).
test("probe: forced flaky on first attempt", () => {
  expect(test.info().retry, "forced first-attempt failure").toBeGreaterThan(0);
});
