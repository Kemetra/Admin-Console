import { expect, test } from "@playwright/test";

// RT-584 PROBE ONLY (throwaway draft PR, never merged): fails on attempt 0 and
// passes on retry, so CI must report it as flaky rather than pass silently.
test("probe: forced flaky on first attempt", async ({}, testInfo) => {
  expect(testInfo.retry, "forced first-attempt failure").toBeGreaterThan(0);
});
