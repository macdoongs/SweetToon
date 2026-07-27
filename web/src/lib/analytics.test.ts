import { describe, expect, it } from "vitest";
import {
  normalizeGoogleAnalyticsId,
  toWebVitalsAnalyticsEvent,
} from "./analytics";

describe("analytics", () => {
  it("enables only a valid GA4 measurement id", () => {
    expect(normalizeGoogleAnalyticsId(" g-ab12cd34 ")).toBe(
      "G-AB12CD34",
    );
    expect(normalizeGoogleAnalyticsId(undefined)).toBeNull();
    expect(normalizeGoogleAnalyticsId("UA-123-1")).toBeNull();
    expect(normalizeGoogleAnalyticsId("G-ID<script>")).toBeNull();
  });

  it("converts Web Vitals to integer GA event values", () => {
    expect(
      toWebVitalsAnalyticsEvent({
        id: "v4-1",
        name: "CLS",
        value: 0.1234,
        rating: "needs-improvement",
        navigationType: "navigate",
      }),
    ).toEqual({
      name: "CLS",
      parameters: {
        value: 123,
        event_label: "v4-1",
        metric_rating: "needs-improvement",
        navigation_type: "navigate",
        non_interaction: true,
      },
    });
  });
});
