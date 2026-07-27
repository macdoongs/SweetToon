export type WebVitalsMetric = {
  id: string;
  name: string;
  value: number;
  rating: string;
  navigationType: string;
};

export type AnalyticsEvent = {
  name: string;
  parameters: {
    value: number;
    event_label: string;
    metric_rating: string;
    navigation_type: string;
    non_interaction: true;
  };
};

export function normalizeGoogleAnalyticsId(
  value: string | undefined,
): string | null {
  const candidate = value?.trim().toUpperCase();
  return candidate && /^G-[A-Z0-9]+$/.test(candidate)
    ? candidate
    : null;
}

export function toWebVitalsAnalyticsEvent(
  metric: WebVitalsMetric,
): AnalyticsEvent {
  return {
    name: metric.name,
    parameters: {
      value: Math.round(
        metric.name === "CLS" ? metric.value * 1000 : metric.value,
      ),
      event_label: metric.id,
      metric_rating: metric.rating,
      navigation_type: metric.navigationType,
      non_interaction: true,
    },
  };
}
