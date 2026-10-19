import { aiPlanViewFor } from "@/ai-entitlements/aiAccess";
import { toPanelModel } from "@/ai-entitlements/aiLogic";
import { describe, expect, test } from "vitest";
import {
  dayMeter,
  exhaustedFeature,
  fullActive,
  fullNone,
  minimalView,
  notInPlanFeature,
  readOnlyFeature,
  switchedOffFeature,
  temporarilyUnavailableFeature,
  trialEndedFeature,
} from "./ai-plan-fixtures";

describe("aiPlanViewFor (RT-665, D-6)", () => {
  test("owner and tenant_admin get the full view, store_manager the minimal one", () => {
    expect(aiPlanViewFor("owner")).toBe("full");
    expect(aiPlanViewFor("tenant_admin")).toBe("full");
    expect(aiPlanViewFor("store_manager")).toBe("minimal");
  });

  test.each(["store_staff", "cashier", "manager", "platform_admin", "", "x", null, undefined])(
    "%s has no access",
    (role) => {
      expect(aiPlanViewFor(role)).toBeUndefined();
    },
  );
});

describe("toPanelModel, full view", () => {
  const model = toPanelModel(fullActive, "full");
  const status = (id: string) =>
    model?.kind === "full" ? model.features.find((f) => f.featureId === id)?.status : undefined;

  test("carries the state, dates and evaluation time as the server states them", () => {
    expect(model).toMatchObject({
      kind: "full",
      state: "active",
      effectiveFrom: "2026-10-01T00:00:00Z",
      effectiveUntil: "2027-10-01T00:00:00Z",
      evaluatedAt: "2026-10-19T09:30:00Z",
    });
  });

  test("maps availability and the four tenant-facing reasons; anything else is temporary", () => {
    expect(status("ai.briefing.daily")).toBe("available");
    expect(status(notInPlanFeature.featureId)).toBe("notInPlan");
    expect(status(trialEndedFeature.featureId)).toBe("trialEnded");
    expect(status(readOnlyFeature.featureId)).toBe("readOnly");
    expect(status(switchedOffFeature.featureId)).toBe("switchedOff");
    expect(status(temporarilyUnavailableFeature.featureId)).toBe("temporarilyUnavailable");
  });

  test("an unknown reason or availability is the temporary state, never a raw code", () => {
    const odd = {
      ...fullActive,
      state: "paused",
      features: [
        { ...notInPlanFeature, unavailableReason: "spend_cap_reached" },
        {
          ...notInPlanFeature,
          featureId: "ai.other.one",
          availability: "maybe",
          unavailableReason: null,
        },
      ],
    };
    const m = toPanelModel(odd, "full");
    expect(m).toMatchObject({ kind: "full", state: "unknown" });
    expect(m?.kind === "full" && m.features.map((f) => f.status)).toEqual([
      "temporarilyUnavailable",
      "temporarilyUnavailable",
    ]);
  });

  test("an exhausted meter is a meter fact, not a feature verdict", () => {
    const m = toPanelModel({ ...fullActive, features: [exhaustedFeature] }, "full");
    expect(m?.kind === "full" && m.features[0].status).toBe("available");
    const meters = m?.kind === "full" ? m.features[0].meters : [];
    expect(meters.map((x) => [x.meter, x.allowanceUsed])).toEqual([
      ["ai.ask.requests", true],
      ["ai.briefing.store_requests", false],
    ]);
  });

  test("meters are kept only for a usable feature, and a zero limit is not 'used up'", () => {
    const entitledButOff = { ...switchedOffFeature, meters: [dayMeter] };
    const noAllowance = {
      ...exhaustedFeature,
      meters: [{ ...dayMeter, limit: 0, used: 0, reserved: 0, remaining: 0 }],
    };
    const m = toPanelModel({ ...fullActive, features: [entitledButOff, noAllowance] }, "full");
    expect(m?.kind === "full" && m.features[0].meters).toEqual([]);
    const meter = m?.kind === "full" ? m.features[1].meters[0] : undefined;
    expect(meter).toMatchObject({ noAllowance: true, allowanceUsed: false });
  });

  test("an opt-out is carried with its date", () => {
    const m = toPanelModel({ ...fullActive, features: [switchedOffFeature] }, "full");
    expect(m?.kind === "full" && m.features[0]).toMatchObject({
      optedOut: true,
      optedOutAt: "2026-10-12T08:15:00Z",
    });
  });

  test("state none has no dates", () => {
    expect(toPanelModel(fullNone, "full")).toMatchObject({
      kind: "full",
      state: "none",
      effectiveFrom: null,
      effectiveUntil: null,
    });
  });

  test("fields outside the contract never reach the model", () => {
    const leaky = {
      ...fullActive,
      price: "49.00",
      planName: "ai_ops",
      creditBalance: 12,
      features: fullActive.features.map((f) => ({
        ...f,
        tokenCost: 0.4,
        meters: f.meters.map((x) => ({ ...x, costUsd: 3 })),
      })),
    };
    const json = JSON.stringify(toPanelModel(leaky, "full"));
    expect(json).not.toMatch(/price|planName|credit|tokenCost|costUsd|ai_ops|49\.00/i);
  });
});

describe("toPanelModel, minimal view", () => {
  test("a minimal body lists availability only", () => {
    expect(toPanelModel(minimalView, "minimal")).toEqual({
      kind: "minimal",
      evaluatedAt: "2026-10-19T09:30:00Z",
      features: [
        { featureId: "ai.briefing.daily", available: true },
        { featureId: "ai.forecast.weekly", available: false },
      ],
    });
  });

  test("store_manager gets the minimal projection even if a full body arrives", () => {
    const m = toPanelModel(fullActive, "minimal");
    expect(m?.kind).toBe("minimal");
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/meter|state|entitlementVersion|optOut|effectiveFrom|reason/i);
    expect(m?.kind === "minimal" && m.features).toHaveLength(fullActive.features.length);
  });

  test("a full-view role whose body is minimal is a load failure, not a minimal list", () => {
    expect(toPanelModel(minimalView, "full")).toBeUndefined();
  });
});

describe("toPanelModel, malformed bodies", () => {
  test.each([
    ["null", null],
    ["a string", "nope"],
    ["an array", []],
    ["no features", { view: "full", state: "active" }],
    ["features not an array", { view: "full", features: {} }],
    ["no view", { features: [{ featureId: "ai.briefing.daily", availability: "available" }] }],
    ["an unknown view", { view: "other", features: [] }],
  ])("%s is not a view", (_name, body) => {
    expect(toPanelModel(body, "full")).toBeUndefined();
    expect(toPanelModel(body, "minimal")).toBeUndefined();
  });

  test("a feature without an id is dropped; bad meters are dropped, not thrown on", () => {
    const m = toPanelModel(
      {
        ...fullActive,
        features: [
          { availability: "available" },
          null,
          {
            ...fullActive.features[0],
            meters: [null, { meter: "x" }, "y", ...fullActive.features[0].meters],
          },
        ],
      },
      "full",
    );
    expect(m?.kind === "full" && m.features).toHaveLength(1);
    expect(m?.kind === "full" && m.features[0].meters).toHaveLength(1);
  });

  test("a feature without a meters array renders with none", () => {
    const m = toPanelModel(
      { ...fullActive, features: [{ featureId: "ai.briefing.daily", availability: "available" }] },
      "full",
    );
    expect(m?.kind === "full" && m.features[0].meters).toEqual([]);
  });
});
