"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import type { SeriesDetail } from "@/lib/reader-types";
import type { StudioSeriesSummary } from "@/lib/studio-types";

// 선택한 작품의 회차 상세만 조회해 작품별로 캐시한다. 목록은 경량 요약으로
// 유지하고, 무거운 상세는 실제로 고른 작품에 대해서만 받아온다.
export function useSeriesDetailCache(
  selectedSummary: StudioSeriesSummary | undefined,
) {
  const [details, setDetails] = useState<Record<string, SeriesDetail>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (
      !selectedSummary ||
      details[selectedSummary.id] ||
      errors[selectedSummary.id]
    ) {
      return;
    }
    const controller = new AbortController();
    getJson<SeriesDetail>(
      `/api/series/${encodeURIComponent(selectedSummary.slug)}`,
      controller.signal,
    )
      .then((detail) => {
        setDetails((current) => ({ ...current, [detail.id]: detail }));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setErrors((current) => ({
          ...current,
          [selectedSummary.id]: true,
        }));
      });
    return () => controller.abort();
  }, [selectedSummary, details, errors]);

  const selectedDetail = selectedSummary
    ? details[selectedSummary.id]
    : undefined;
  const failed = Boolean(
    selectedSummary && !selectedDetail && errors[selectedSummary.id],
  );
  const loading = Boolean(selectedSummary && !selectedDetail && !failed);

  function invalidate(seriesId: string) {
    setDetails((current) => {
      if (!current[seriesId]) return current;
      const next = { ...current };
      delete next[seriesId];
      return next;
    });
  }

  function retry() {
    if (!selectedSummary) return;
    setErrors((current) => {
      if (!current[selectedSummary.id]) return current;
      const next = { ...current };
      delete next[selectedSummary.id];
      return next;
    });
  }

  return { details, selectedDetail, loading, failed, invalidate, retry };
}
