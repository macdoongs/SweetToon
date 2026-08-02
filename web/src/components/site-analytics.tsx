"use client";

import { useCallback } from "react";
import Script from "next/script";
import { useReportWebVitals } from "next/web-vitals";
import {
  normalizeGoogleAnalyticsId,
  toWebVitalsAnalyticsEvent,
} from "@/lib/analytics";

type Gtag = (
  command: "event",
  eventName: string,
  parameters: Record<string, string | number | boolean>,
) => void;

export function SiteAnalytics({
  measurementId: rawMeasurementId,
}: {
  measurementId?: string;
}) {
  const measurementId = normalizeGoogleAnalyticsId(rawMeasurementId);
  const reportWebVitals = useCallback<
    Parameters<typeof useReportWebVitals>[0]
  >(
    (metric) => {
      if (!measurementId) return;
      const gtag = (window as typeof window & { gtag?: Gtag }).gtag;
      if (!gtag) return;

      const event = toWebVitalsAnalyticsEvent(metric);
      gtag("event", event.name, event.parameters);
    },
    [measurementId],
  );

  useReportWebVitals(reportWebVitals);

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="sweettoon-google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}
