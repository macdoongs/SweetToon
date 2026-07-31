"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import type { DraftEpisode, PackagingRequest } from "@/lib/studio-types";

export type StudioCollectionState = "loading" | "ready" | "error";

// 비공개 보관함과 패키징 신청 이력을 함께 조회한다. 두 컬렉션은 작품
// 선택과 무관한 스튜디오 전역 데이터라 한 번만 불러오고 재시도를 공유한다.
export function useStudioCollections() {
  const [drafts, setDrafts] = useState<DraftEpisode[]>([]);
  const [draftsState, setDraftsState] =
    useState<StudioCollectionState>("loading");
  const [packagingRequests, setPackagingRequests] = useState<
    PackagingRequest[]
  >([]);
  const [packagingState, setPackagingState] =
    useState<StudioCollectionState>("loading");
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ items: DraftEpisode[] }>(
      "/api/studio/drafts",
      controller.signal,
    )
      .then((response) => {
        setDrafts(response.items);
        setDraftsState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setDraftsState("error");
      });
    getJson<{ items: PackagingRequest[] }>(
      "/api/studio/packaging-requests",
      controller.signal,
    )
      .then((response) => {
        setPackagingRequests(response.items);
        setPackagingState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setPackagingState("error");
      });
    return () => controller.abort();
  }, [loadKey]);

  function retry() {
    setDraftsState("loading");
    setPackagingState("loading");
    setLoadKey((current) => current + 1);
  }

  return {
    drafts,
    setDrafts,
    draftsState,
    packagingRequests,
    setPackagingRequests,
    packagingState,
    retry,
  };
}
