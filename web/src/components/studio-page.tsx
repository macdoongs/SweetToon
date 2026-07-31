"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  deleteRequest,
  isUncertainRequestError,
  patchJson,
  postFormData,
  postJson,
} from "@/lib/api";
import { useSeriesDetailCache } from "@/lib/use-series-detail-cache";
import { useStudioCollections } from "@/lib/use-studio-collections";
import { StudioDraftsShelf } from "./studio-drafts-shelf";
import { StudioEpisodeManager } from "./studio-episode-manager";
import { StudioPackagingHistory } from "./studio-packaging-history";
import type { SeriesDetail } from "@/lib/reader-types";
import type {
  AccessPolicy,
  AccessPolicyResponse,
  CreatedEpisode,
  CreateEpisodeRequest,
  CreatePackagingRequest,
  CreateSeriesRequest,
  CreateSeriesResponse,
  DraftEpisode,
  PackagingBookSize,
  PackagingCoverType,
  PackagingRequest,
  SeriesInfoResponse,
  StudioSeasonResponse,
  UpdateSeriesInfoRequest,
  UploadPreview,
  StudioSeriesSummary,
  UploadPurpose,
} from "@/lib/studio-types";
import {
  loadSecurityAccessKey,
  saveSecurityAccessKey,
} from "@/lib/security-access";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const PURPOSE_OPTIONS: Array<{
  value: UploadPurpose;
  label: string;
  description: string;
}> = [
  {
    value: "publish",
    label: "즉시 공개",
    description: "새 에피소드를 독자에게 바로 엽니다.",
  },
  {
    value: "draft",
    label: "비공개 보관",
    description: "링크를 아는 사람만 볼 수 있게 임시로 보관합니다.",
  },
  {
    value: "packaging",
    label: "책 패키징 신청",
    description: "원고 묶음으로 실물 책 패키징 서비스를 신청합니다.",
  },
];

type NewSeriesDraft = Omit<CreateSeriesRequest, "requestKey">;
type IdempotentAttempt = { fingerprint: string; requestKey: string };

const EMPTY_NEW_SERIES: NewSeriesDraft = {
  slug: "",
  title: "",
  synopsis: "",
  genre: "",
  weekday: "mon",
  authorName: "",
};

const WEEKDAY_LABEL: Record<CreateSeriesRequest["weekday"], string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

export function StudioPage({
  initialPurpose = "publish",
  seriesList,
}: {
  initialPurpose?: UploadPurpose;
  seriesList: StudioSeriesSummary[];
}) {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState(() =>
    loadSecurityAccessKey("studio"),
  );
  const mutationHeaders: Record<string, string> = accessKey.trim()
    ? { "x-sweettoon-studio-key": accessKey.trim() }
    : {};
  const availableSeries = useMemo(
    () =>
      seriesList.filter((item) =>
        item.seasons.some((season) => season.status === "ongoing"),
      ),
    [seriesList],
  );
  const [purpose, setPurpose] = useState<UploadPurpose>(initialPurpose);
  const [seriesId, setSeriesId] = useState(availableSeries[0]?.id ?? "");
  const [policies, setPolicies] = useState<Record<string, AccessPolicy>>({});
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [seriesOverrides, setSeriesOverrides] = useState<
    Record<string, { title: string; synopsis: string }>
  >({});
  const [seriesEdit, setSeriesEdit] = useState<
    { title: string; synopsis: string } | null
  >(null);
  const [seriesEditBusy, setSeriesEditBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [seriesEditMessage, setSeriesEditMessage] = useState<string | null>(
    null,
  );
  const [newSeries, setNewSeries] =
    useState<NewSeriesDraft>(EMPTY_NEW_SERIES);
  const [newSeriesBusy, setNewSeriesBusy] = useState(false);
  const [newSeriesMessage, setNewSeriesMessage] = useState<string | null>(
    null,
  );
  const [manageSeriesId, setManageSeriesId] = useState(
    seriesList[0]?.id ?? "",
  );
  const [seasonBusyId, setSeasonBusyId] = useState<string | null>(null);
  const [seasonMessage, setSeasonMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deletedEpisodeIds, setDeletedEpisodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedSummary =
    availableSeries.find((item) => item.id === seriesId) ??
    availableSeries[0];
  const [seasonId, setSeasonId] = useState("");
  const [draftBusyId, setDraftBusyId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<
    { id: string; title: string; number: number } | null
  >(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  const [episodeOverrides, setEpisodeOverrides] = useState<
    Record<string, { title: string; number: number }>
  >({});

  const {
    drafts,
    setDrafts,
    draftsState,
    packagingRequests,
    setPackagingRequests,
    packagingState: packagingRequestsState,
    retry: retryCollections,
  } = useStudioCollections();

  const nextNumberFor = useCallback(
    (season: SeriesDetail["seasons"][number] | undefined) => {
      if (!season) return 1;
      return (
        Math.max(
          0,
          ...season.episodes.map((episode) => episode.number),
          ...drafts
            .filter((draft) => draft.season.id === season.id)
            .map((draft) => draft.number),
        ) + 1
      );
    },
    [drafts],
  );

  const detailCache = useSeriesDetailCache(selectedSummary);
  const selectedSeries = detailCache.selectedDetail;
  // 공개 정책은 사용자가 편집한 값이 있으면 그 값을, 없으면 상세 응답의
  // 현재 값을 쓴다. 상태 동기화 대신 파생으로 항상 최신을 유지한다.
  const selectedPolicy = selectedSeries
    ? policies[selectedSeries.id] ?? {
        freeVolumeCount: selectedSeries.freeVolumeCount,
        previewEpisodeCount: selectedSeries.previewEpisodeCount,
      }
    : undefined;
  const ongoingSeasons =
    selectedSeries?.seasons.filter((season) => season.status === "ongoing") ??
    [];
  const selectedSeason =
    ongoingSeasons.find((season) => season.id === seasonId) ??
    ongoingSeasons[0];

  const fileInput = useRef<HTMLInputElement>(null);
  const episodeAttempt = useRef<IdempotentAttempt | null>(null);
  const packagingAttempt = useRef<IdempotentAttempt | null>(null);
  const seriesAttempt = useRef<IdempotentAttempt | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  // 회차 번호도 파생이 기본값이다. 사용자가 직접 고치면 그 값을 쓰고,
  // 작품·시즌을 바꾸거나 발행을 마치면 추천 번호로 되돌아간다.
  const [episodeNumberOverride, setEpisodeNumberOverride] = useState<
    number | null
  >(null);
  const episodeNumber = episodeNumberOverride ?? nextNumberFor(selectedSeason);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedEpisode | null>(null);

  const [replaceTarget, setReplaceTarget] = useState<
    { id: string; number: number; title: string } | null
  >(null);
  const [replaceResult, setReplaceResult] = useState<CreatedEpisode | null>(
    null,
  );

  const [applicantName, setApplicantName] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookSize, setBookSize] = useState<PackagingBookSize>("A5");
  const [coverType, setCoverType] = useState<PackagingCoverType>("softcover");
  const [quantity, setQuantity] = useState(1);
  const [packagingMemo, setPackagingMemo] = useState("");
  const [packagingResult, setPackagingResult] =
    useState<PackagingRequest | null>(null);

  function applyPurpose(next: UploadPurpose) {
    setPurpose(next);
    setError(null);
    setCreated(null);
    setPackagingResult(null);
  }

  // 업로드 목적을 URL과 동기화해 새로고침·공유·뒤로가기에서 복원한다.
  function changePurpose(next: UploadPurpose) {
    if (next === purpose) return;
    applyPurpose(next);
    const nextUrl =
      next === "publish" ? "/studio" : `/studio?mode=${next}`;
    window.history.pushState(window.history.state, "", nextUrl);
  }

  useEffect(() => {
    const restore = () => {
      const mode = new URLSearchParams(window.location.search).get("mode");
      const next =
        mode === "draft" || mode === "packaging" ? mode : "publish";
      setPurpose(next);
      setError(null);
      setCreated(null);
      setPackagingResult(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function chooseSeries(nextSeriesId: string) {
    setSeriesId(nextSeriesId);
    setPolicyMessage(null);
    setSeriesEdit(null);
    setSeriesEditMessage(null);
    // 시즌은 새 작품의 첫 연재 시즌으로, 회차 번호는 추천값으로 돌아간다.
    setSeasonId("");
    setEpisodeNumberOverride(null);
  }

  function handleDeleteClick(episodeId: string) {
    if (deleteConfirmId === episodeId) {
      void removeEpisode(episodeId);
    } else {
      setDeleteConfirmId(episodeId);
    }
  }

  const displayedSeriesTitle = selectedSeries
    ? seriesOverrides[selectedSeries.id]?.title ?? selectedSeries.title
    : "";
  const displayedSeriesSynopsis = selectedSeries
    ? seriesOverrides[selectedSeries.id]?.synopsis ?? selectedSeries.synopsis
    : "";

  async function saveSeriesInfo() {
    if (!selectedSeries) return;
    const nextTitle = (seriesEdit?.title ?? displayedSeriesTitle).trim();
    const nextSynopsis = (
      seriesEdit?.synopsis ?? displayedSeriesSynopsis
    ).trim();
    if (nextTitle.length === 0 || nextSynopsis.length === 0) {
      setSeriesEditMessage("제목과 줄거리를 비워 둘 수 없어요.");
      return;
    }
    setSeriesEditBusy(true);
    setSeriesEditMessage(null);
    try {
      const updated = await patchJson<
        UpdateSeriesInfoRequest,
        SeriesInfoResponse
      >(
        `/api/studio/series/${encodeURIComponent(selectedSeries.id)}`,
        { title: nextTitle, synopsis: nextSynopsis },
        mutationHeaders,
      );
      setSeriesOverrides((current) => ({
        ...current,
        [updated.seriesId]: {
          title: updated.title,
          synopsis: updated.synopsis,
        },
      }));
      setSeriesEdit(null);
      setSeriesEditMessage(
        "작품 정보를 저장했어요. 독자 주소(slug)는 그대로 유지됩니다.",
      );
    } catch (reason) {
      setSeriesEditMessage(
        reason instanceof ApiError
          ? reason.message
          : "작품 정보를 저장하지 못했습니다.",
      );
    } finally {
      setSeriesEditBusy(false);
    }
  }

  async function saveAccessPolicy() {
    if (!selectedSeries || !selectedPolicy) return;
    if (
      !Number.isInteger(selectedPolicy.freeVolumeCount) ||
      selectedPolicy.freeVolumeCount < 0 ||
      selectedPolicy.freeVolumeCount > 20
    ) {
      setPolicyMessage("무료 공개 권수는 0에서 20 사이 숫자여야 해요.");
      return;
    }
    setPolicyBusy(true);
    setPolicyMessage(null);
    try {
      const updated = await patchJson<AccessPolicy, AccessPolicyResponse>(
        `/api/studio/series/${encodeURIComponent(selectedSeries.id)}/access-policy`,
        selectedPolicy,
        mutationHeaders,
      );
      setPolicies((current) => ({
        ...current,
        [updated.seriesId]: updated,
      }));
      setPolicyMessage("독자 공개 범위를 저장했어요.");
    } catch (reason) {
      setPolicyMessage(
        reason instanceof ApiError
          ? reason.message
          : "공개 범위를 저장하지 못했습니다.",
      );
    } finally {
      setPolicyBusy(false);
    }
  }

  function chooseSeason(nextSeasonId: string) {
    setSeasonId(nextSeasonId);
    setEpisodeNumberOverride(null);
  }

  async function uploadArchive(file: File | undefined) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "zip" && extension !== "cbz") {
      setError("확장자가 .zip 또는 .cbz인 파일을 선택해 주세요.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("ZIP 파일은 25MB 이하로 올려 주세요.");
      return;
    }

    if (preview) {
      await deleteRequest(
        `/api/studio/uploads/${encodeURIComponent(preview.sessionId)}`,
        mutationHeaders,
      ).catch(() => undefined);
    }
    setBusy("upload");
    setError(null);
    setCreated(null);
    setPackagingResult(null);
    setReplaceResult(null);
    const formData = new FormData();
    formData.append("archive", file);
    try {
      const result = await postFormData<UploadPreview>(
        "/api/studio/uploads",
        formData,
        mutationHeaders,
      );
      setPreview(result);
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "원고를 분석하지 못했습니다.",
      );
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function movePage(index: number, direction: -1 | 1) {
    if (!preview) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= preview.pages.length) return;
    const pages = [...preview.pages];
    [pages[index], pages[nextIndex]] = [pages[nextIndex], pages[index]];
    setPreview({ ...preview, pages });
  }

  async function publishEpisode() {
    if (!preview || !selectedSeason) return;
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
      setError("회차 번호는 1 이상의 숫자여야 해요.");
      return;
    }
    // 제목을 비워 두면 회차 번호로 자동 지정한다. 등록 뒤에도 수정할 수 있다.
    const resolvedTitle = title.trim() || `${episodeNumber}화`;
    const visibility = purpose === "draft" ? "private" : "public";
    const payload: Omit<CreateEpisodeRequest, "requestKey"> = {
      sessionId: preview.sessionId,
      seasonId: selectedSeason.id,
      number: episodeNumber,
      title: resolvedTitle,
      pageIds: preview.pages.map((page) => page.id),
      visibility,
    };
    const requestKey = idempotencyKeyFor(episodeAttempt, payload);
    setBusy("publish");
    setError(null);
    try {
      const result = await postJson<CreateEpisodeRequest, CreatedEpisode>(
        "/api/studio/episodes",
        {
          requestKey,
          ...payload,
        },
        undefined,
        mutationHeaders,
      );
      episodeAttempt.current = null;
      setCreated(result);
      setPreview(null);
      if (result.visibility === "public" && selectedSeries) {
        // 공개 발행은 등록 회차 목록과 추천 번호에 바로 반영한다.
        detailCache.invalidate(selectedSeries.id);
      }
      if (result.visibility === "private" && selectedSeries) {
        setDrafts((current) => [
          {
            id: result.episodeId,
            number: episodeNumber,
            title: resolvedTitle,
            publishedAt: new Date().toISOString(),
            season: {
              id: selectedSeason.id,
              number: selectedSeason.number,
            },
            series: {
              slug: selectedSeries.slug,
              title: selectedSeries.title,
            },
          },
          ...current,
        ]);
      }
    } catch (reason) {
      if (!isUncertainRequestError(reason)) episodeAttempt.current = null;
      setError(
        reason instanceof ApiError
          ? reason.message
          : "에피소드를 등록하지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function submitPackagingRequest() {
    if (!preview) return;
    if (applicantName.trim().length < 2) {
      setError("신청자 이름을 두 글자 이상 입력해 주세요.");
      return;
    }
    if (bookTitle.trim().length === 0) {
      setError("만들 책의 제목을 입력해 주세요.");
      return;
    }
    const payload: Omit<CreatePackagingRequest, "requestKey"> = {
      sessionId: preview.sessionId,
      pageIds: preview.pages.map((page) => page.id),
      applicantName: applicantName.trim(),
      bookTitle: bookTitle.trim(),
      bookSize,
      coverType,
      quantity,
      memo: packagingMemo.trim() || null,
    };
    const requestKey = idempotencyKeyFor(packagingAttempt, payload);
    setBusy("publish");
    setError(null);
    try {
      const result = await postJson<
        CreatePackagingRequest,
        PackagingRequest
      >(
        "/api/studio/packaging-requests",
        {
          requestKey,
          ...payload,
        },
        undefined,
        mutationHeaders,
      );
      packagingAttempt.current = null;
      setPackagingResult(result);
      setPackagingRequests((current) => [result, ...current]);
      setPreview(null);
      setBookTitle("");
      setPackagingMemo("");
    } catch (reason) {
      if (!isUncertainRequestError(reason)) packagingAttempt.current = null;
      setError(
        reason instanceof ApiError
          ? reason.message
          : "패키징 신청을 접수하지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  const manageSeries =
    seriesList.find((item) => item.id === manageSeriesId) ?? seriesList[0];

  async function uploadCover(file: File | undefined) {
    if (!selectedSeries || !file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (
      !["png", "jpg", "jpeg", "webp"].includes(extension ?? "") ||
      (file.type !== "" && !allowedTypes.has(file.type))
    ) {
      setSeriesEditMessage("PNG, JPG 또는 WebP 표지 이미지를 선택해 주세요.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSeriesEditMessage("표지 이미지는 5MB 이하로 올려 주세요.");
      return;
    }
    setCoverBusy(true);
    setSeriesEditMessage(null);
    const formData = new FormData();
    formData.append("cover", file);
    try {
      await postFormData<{ seriesId: string; coverUrl: string }>(
        `/api/studio/series/${encodeURIComponent(selectedSeries.id)}/cover`,
        formData,
        mutationHeaders,
      );
      setSeriesEditMessage("표지를 교체했어요. 목록과 상세에 곧 반영됩니다.");
      router.refresh();
    } catch (reason) {
      setSeriesEditMessage(
        reason instanceof ApiError
          ? reason.message
          : "표지를 올리지 못했습니다.",
      );
    } finally {
      setCoverBusy(false);
    }
  }

  async function changeSeasonStatus(
    seasonId: string,
    status: "ongoing" | "completed",
  ) {
    setSeasonBusyId(seasonId);
    setSeasonMessage(null);
    try {
      const updated = await patchJson<
        { status: "ongoing" | "completed" },
        StudioSeasonResponse
      >(
        `/api/studio/seasons/${encodeURIComponent(seasonId)}/status`,
        { status },
        mutationHeaders,
      );
      setSeasonMessage(
        updated.status === "completed"
          ? `시즌 ${updated.number}을 완결 처리했어요. 이제 독자가 소장본을 주문할 수 있습니다.`
          : `시즌 ${updated.number} 연재를 다시 시작했어요.`,
      );
      detailCache.invalidate(updated.seriesId);
      router.refresh();
    } catch (reason) {
      setSeasonMessage(
        reason instanceof ApiError
          ? reason.message
          : "시즌 상태를 바꾸지 못했습니다.",
      );
    } finally {
      setSeasonBusyId(null);
    }
  }

  async function startNextSeason() {
    if (!manageSeries) return;
    setSeasonBusyId("new");
    setSeasonMessage(null);
    try {
      const created = await postJson<
        Record<string, never>,
        StudioSeasonResponse
      >(
        `/api/studio/series/${encodeURIComponent(manageSeries.id)}/seasons`,
        {},
        undefined,
        mutationHeaders,
      );
      setSeasonMessage(`시즌 ${created.number} 연재를 시작했어요.`);
      detailCache.invalidate(created.seriesId);
      router.refresh();
    } catch (reason) {
      setSeasonMessage(
        reason instanceof ApiError
          ? reason.message
          : "새 시즌을 만들지 못했습니다.",
      );
    } finally {
      setSeasonBusyId(null);
    }
  }

  async function createNewSeries() {
    const payload: NewSeriesDraft = {
      slug: newSeries.slug.trim(),
      title: newSeries.title.trim(),
      synopsis: newSeries.synopsis.trim(),
      genre: newSeries.genre.trim(),
      weekday: newSeries.weekday,
      authorName: newSeries.authorName.trim(),
    };
    if (
      !payload.slug ||
      !payload.title ||
      !payload.synopsis ||
      !payload.genre ||
      !payload.authorName
    ) {
      setNewSeriesMessage("모든 항목을 입력해 주세요.");
      return;
    }
    const requestKey = idempotencyKeyFor(seriesAttempt, payload);
    setNewSeriesBusy(true);
    setNewSeriesMessage(null);
    try {
      const created = await postJson<
        CreateSeriesRequest,
        CreateSeriesResponse
      >(
        "/api/studio/series",
        { requestKey, ...payload },
        undefined,
        mutationHeaders,
      );
      seriesAttempt.current = null;
      setNewSeries(EMPTY_NEW_SERIES);
      setNewSeriesMessage(
        `《${created.title}》 시즌 1이 준비됐어요. 이제 원고를 올릴 수 있습니다.`,
      );
      setSeriesId(created.seriesId);
      setSeasonId(created.seasonId);
      // 서버 컴포넌트 데이터를 다시 받아 드롭다운에 새 작품을 반영한다.
      router.refresh();
    } catch (reason) {
      if (!isUncertainRequestError(reason)) seriesAttempt.current = null;
      setNewSeriesMessage(
        reason instanceof ApiError
          ? reason.message
          : "작품을 만들지 못했습니다.",
      );
    } finally {
      setNewSeriesBusy(false);
    }
  }

  async function removeEpisode(episodeId: string) {
    setDeleteBusyId(episodeId);
    try {
      await deleteRequest(
        `/api/studio/episodes/${encodeURIComponent(episodeId)}`,
        mutationHeaders,
      );
      setDeletedEpisodeIds((current) => {
        const next = new Set(current);
        next.add(episodeId);
        return next;
      });
      setDrafts((current) =>
        current.filter((draft) => draft.id !== episodeId),
      );
      setRenameMessage("에피소드와 원고 파일을 삭제했어요.");
    } catch (reason) {
      setRenameMessage(
        reason instanceof ApiError
          ? reason.message
          : "에피소드를 삭제하지 못했습니다.",
      );
    } finally {
      setDeleteBusyId(null);
      setDeleteConfirmId(null);
    }
  }

  function startReplace(episode: {
    id: string;
    number: number;
    title: string;
  }) {
    setReplaceTarget(episode);
    setReplaceResult(null);
    setCreated(null);
    setPackagingResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitReplacePages() {
    if (!preview || !replaceTarget) return;
    setBusy("publish");
    setError(null);
    try {
      const result = await patchJson<
        { sessionId: string; pageIds: string[] },
        CreatedEpisode
      >(
        `/api/studio/episodes/${encodeURIComponent(replaceTarget.id)}/pages`,
        {
          sessionId: preview.sessionId,
          pageIds: preview.pages.map((page) => page.id),
        },
        mutationHeaders,
      );
      setReplaceResult(result);
      setReplaceTarget(null);
      setPreview(null);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "원고를 교체하지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveRename() {
    if (!renameTarget) return;
    const nextTitle = renameTarget.title.trim();
    if (nextTitle.length === 0) {
      setRenameMessage("제목을 한 글자 이상 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(renameTarget.number) || renameTarget.number < 1) {
      setRenameMessage("회차 번호는 1 이상의 숫자여야 해요.");
      return;
    }
    setRenameBusy(true);
    setRenameMessage(null);
    try {
      const updated = await patchJson<
        { title: string; number: number },
        DraftEpisode
      >(
        `/api/studio/episodes/${encodeURIComponent(renameTarget.id)}`,
        { title: nextTitle, number: renameTarget.number },
        mutationHeaders,
      );
      setEpisodeOverrides((current) => ({
        ...current,
        [updated.id]: { title: updated.title, number: updated.number },
      }));
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === updated.id
            ? { ...draft, title: updated.title, number: updated.number }
            : draft,
        ),
      );
      setRenameTarget(null);
      setRenameMessage("에피소드 정보를 수정했어요.");
    } catch (reason) {
      setRenameMessage(
        reason instanceof ApiError
          ? reason.message
          : "에피소드를 수정하지 못했습니다.",
      );
    } finally {
      setRenameBusy(false);
    }
  }

  async function publishDraft(episodeId: string) {
    setDraftBusyId(episodeId);
    setDraftMessage(null);
    try {
      await patchJson<{ visibility: "public" }, DraftEpisode>(
        `/api/studio/episodes/${encodeURIComponent(episodeId)}/visibility`,
        { visibility: "public" },
        mutationHeaders,
      );
      setDrafts((current) =>
        current.filter((draft) => draft.id !== episodeId),
      );
      setDraftMessage("보관 중이던 에피소드를 독자에게 공개했어요.");
    } catch (reason) {
      setDraftMessage(
        reason instanceof ApiError
          ? reason.message
          : "에피소드를 공개하지 못했습니다.",
      );
    } finally {
      setDraftBusyId(null);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadArchive(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadArchive(event.dataTransfer.files[0]);
  }

  const needsSeason = purpose !== "packaging";
  const seasonUnavailable = needsSeason && availableSeries.length === 0;

  return (
    <main className="studio-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">작가 스튜디오</strong>
      </nav>
      <header className="studio-header">
        <div>
          <p className="eyebrow">Creator studio</p>
          <h1>원고 한 묶음을<br />새 에피소드로.</h1>
        </div>
        <p>
          작업 폴더의 이미지를 ZIP 또는 CBZ로 묶어 올리세요. 바로 공개하는
          것 외에도 비공개로 보관하거나, 실물 책 패키징 서비스를 신청할 수
          있습니다.
        </p>
      </header>

      <div className="studio-layout">
        <aside className="studio-settings">
          <p className="eyebrow">Upload purpose</p>
          <fieldset className="studio-purpose" aria-label="업로드 목적">
            {PURPOSE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={
                  purpose === option.value
                    ? "studio-purpose__option studio-purpose__option--active"
                    : "studio-purpose__option"
                }
              >
                <input
                  checked={purpose === option.value}
                  name="upload-purpose"
                  onChange={() => changePurpose(option.value)}
                  type="radio"
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <details className="studio-security-access studio-new-series">
            <summary>새 작품 만들기</summary>
            <label className="field">
              <span>주소(slug)</span>
              <input
                maxLength={80}
                onChange={(event) =>
                  setNewSeries((current) => ({
                    ...current,
                    slug: event.target.value.toLowerCase(),
                  }))
                }
                placeholder="night-market"
                value={newSeries.slug}
              />
            </label>
            <label className="field">
              <span>새 작품 제목</span>
              <input
                maxLength={80}
                onChange={(event) =>
                  setNewSeries((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                value={newSeries.title}
              />
            </label>
            <label className="field">
              <span>줄거리</span>
              <textarea
                maxLength={1000}
                onChange={(event) =>
                  setNewSeries((current) => ({
                    ...current,
                    synopsis: event.target.value,
                  }))
                }
                rows={3}
                value={newSeries.synopsis}
              />
            </label>
            <div className="studio-number-title">
              <label className="field">
                <span>장르</span>
                <input
                  maxLength={40}
                  onChange={(event) =>
                    setNewSeries((current) => ({
                      ...current,
                      genre: event.target.value,
                    }))
                  }
                  value={newSeries.genre}
                />
              </label>
              <label className="field">
                <span>연재 요일</span>
                <select
                  onChange={(event) =>
                    setNewSeries((current) => ({
                      ...current,
                      weekday: event.target
                        .value as CreateSeriesRequest["weekday"],
                    }))
                  }
                  value={newSeries.weekday}
                >
                  {(
                    Object.keys(WEEKDAY_LABEL) as Array<
                      CreateSeriesRequest["weekday"]
                    >
                  ).map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {WEEKDAY_LABEL[weekday]}요일
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>작가 이름</span>
              <input
                maxLength={40}
                onChange={(event) =>
                  setNewSeries((current) => ({
                    ...current,
                    authorName: event.target.value,
                  }))
                }
                value={newSeries.authorName}
              />
            </label>
            <button
              className="button button--primary button--wide"
              disabled={newSeriesBusy}
              onClick={() => void createNewSeries()}
              type="button"
            >
              {newSeriesBusy ? "만드는 중…" : "작품 만들기"}
            </button>
            <p aria-live="polite">
              {newSeriesMessage ??
                "시즌 1이 함께 만들어져 바로 연재를 시작할 수 있어요."}
            </p>
          </details>
          {manageSeries ? (
            <details className="studio-security-access studio-season-manage">
              <summary>시즌 관리</summary>
              <label className="field">
                <span>관리할 작품</span>
                <select
                  onChange={(event) => {
                    setManageSeriesId(event.target.value);
                    setSeasonMessage(null);
                  }}
                  value={manageSeries.id}
                >
                  {seriesList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {seriesOverrides[item.id]?.title ?? item.title}
                    </option>
                  ))}
                </select>
              </label>
              <ul className="studio-season-manage__list">
                {manageSeries.seasons.map((season) => (
                  <li key={season.id}>
                    <span>
                      시즌 {season.number} ·{" "}
                      {season.status === "completed" ? "완결" : "연재 중"}
                    </span>
                    <button
                      className="button button--ghost"
                      disabled={seasonBusyId !== null}
                      onClick={() =>
                        void changeSeasonStatus(
                          season.id,
                          season.status === "completed"
                            ? "ongoing"
                            : "completed",
                        )
                      }
                      type="button"
                    >
                      {seasonBusyId === season.id
                        ? "변경 중…"
                        : season.status === "completed"
                          ? "연재 재개"
                          : "완결 처리"}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="button button--ghost button--wide"
                disabled={seasonBusyId !== null}
                onClick={() => void startNextSeason()}
                type="button"
              >
                {seasonBusyId === "new" ? "만드는 중…" : "새 시즌 시작"}
              </button>
              <p aria-live="polite">
                {seasonMessage ??
                  "완결된 시즌만 소장본 주문이 가능하고, 새 회차는 연재 중인 시즌에만 올릴 수 있어요."}
              </p>
            </details>
          ) : null}
          <details className="studio-security-access">
            <summary>운영 보안 설정</summary>
            <label className="field">
              <span>스튜디오 접근 키</span>
              <input
                autoComplete="off"
                onChange={(event) => {
                  setAccessKey(event.target.value);
                  saveSecurityAccessKey("studio", event.target.value);
                }}
                placeholder="운영 strict 모드에서만 필요"
                type="password"
                value={accessKey}
              />
            </label>
            <p>키는 현재 탭의 sessionStorage에만 보관됩니다.</p>
          </details>

          {needsSeason && !seasonUnavailable ? (
            <>
              <label className="field">
                <span>작품</span>
                <select
                  onChange={(event) => chooseSeries(event.target.value)}
                  value={selectedSummary?.id}
                >
                  {availableSeries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {seriesOverrides[item.id]?.title ?? item.title}
                    </option>
                  ))}
                </select>
              </label>
              {detailCache.loading ? (
                <p aria-busy="true">작품 정보를 불러오는 중…</p>
              ) : null}
              {detailCache.failed ? (
                <p role="alert">
                  작품 정보를 불러오지 못했어요.{" "}
                  <button
                    className="button button--ghost"
                    onClick={detailCache.retry}
                    type="button"
                  >
                    다시 시도
                  </button>
                </p>
              ) : null}
              {selectedSeries ? (
                <details className="studio-security-access studio-series-edit">
                  <summary>작품 정보 수정</summary>
                  <label className="field">
                    <span>작품 제목</span>
                    <input
                      maxLength={80}
                      onChange={(event) =>
                        setSeriesEdit({
                          title: event.target.value,
                          synopsis:
                            seriesEdit?.synopsis ?? displayedSeriesSynopsis,
                        })
                      }
                      value={seriesEdit?.title ?? displayedSeriesTitle}
                    />
                  </label>
                  <label className="field">
                    <span>줄거리</span>
                    <textarea
                      maxLength={1000}
                      onChange={(event) =>
                        setSeriesEdit({
                          title: seriesEdit?.title ?? displayedSeriesTitle,
                          synopsis: event.target.value,
                        })
                      }
                      rows={4}
                      value={seriesEdit?.synopsis ?? displayedSeriesSynopsis}
                    />
                  </label>
                  <label className="field">
                    <span>
                      표지 이미지 <small>PNG/JPG/WebP · 5MB 이하</small>
                    </span>
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      disabled={coverBusy}
                      onChange={(event) => {
                        const input = event.target;
                        void uploadCover(input.files?.[0]).finally(() => {
                          input.value = "";
                        });
                      }}
                      type="file"
                    />
                  </label>
                  <button
                    className="button button--ghost button--wide"
                    disabled={seriesEditBusy || seriesEdit === null}
                    onClick={() => void saveSeriesInfo()}
                    type="button"
                  >
                    {seriesEditBusy ? "저장 중…" : "작품 정보 저장"}
                  </button>
                  <p aria-live="polite">
                    {seriesEditMessage ??
                      "독자 주소(slug)는 바뀌지 않아요."}
                  </p>
                </details>
              ) : null}
              {purpose === "publish" && selectedSeries && selectedPolicy ? (
                <section className="studio-access-policy">
                  <div>
                    <strong>독자 공개 범위</strong>
                    <p>한 권은 5화이며, 무료 권 다음에 일부 화를 더 공개할 수 있어요.</p>
                  </div>
                  <label className="field">
                    <span>무료 공개 권 수</span>
                    <input
                      max={20}
                      min={0}
                      onChange={(event) =>
                        setPolicies((current) => ({
                          ...current,
                          [selectedSeries.id]: {
                            ...selectedPolicy,
                            freeVolumeCount: event.target.valueAsNumber || 0,
                          },
                        }))
                      }
                      type="number"
                      value={selectedPolicy.freeVolumeCount}
                    />
                  </label>
                  <label className="field">
                    <span>다음 권 미리보기</span>
                    <select
                      onChange={(event) =>
                        setPolicies((current) => ({
                          ...current,
                          [selectedSeries.id]: {
                            ...selectedPolicy,
                            previewEpisodeCount: Number(event.target.value),
                          },
                        }))
                      }
                      value={selectedPolicy.previewEpisodeCount}
                    >
                      {[0, 1, 2, 3, 4].map((count) => (
                        <option key={count} value={count}>
                          {count}화
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button--ghost button--wide"
                    disabled={policyBusy}
                    onClick={() => void saveAccessPolicy()}
                    type="button"
                  >
                    {policyBusy ? "저장 중…" : "공개 범위 저장"}
                  </button>
                  {policyMessage ? (
                    <p aria-live="polite">{policyMessage}</p>
                  ) : null}
                </section>
              ) : null}
              {selectedSeries ? (
                <>
                  <label className="field">
                    <span>시즌</span>
                    <select
                      onChange={(event) => chooseSeason(event.target.value)}
                      value={selectedSeason?.id}
                    >
                      {ongoingSeasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          시즌 {season.number} · {season.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="studio-number-title">
                    <label className="field">
                      <span>회차</span>
                      <input
                        min={1}
                        onChange={(event) =>
                          setEpisodeNumberOverride(
                            event.target.valueAsNumber || 0,
                          )
                        }
                        type="number"
                        value={episodeNumber}
                      />
                    </label>
                    <label className="field">
                      <span>
                        제목{" "}
                        <small>비우면 “{episodeNumber}화”로 저장돼요</small>
                      </span>
                      <input
                        maxLength={80}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={`${episodeNumber}화`}
                        value={title}
                      />
                    </label>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {purpose === "packaging" ? (
            <section className="studio-packaging-form" aria-label="패키징 신청 정보">
              <div>
                <strong>책 사양</strong>
                <p>업로드한 원고가 그대로 내지가 됩니다.</p>
              </div>
              <label className="field">
                <span>신청자 이름</span>
                <input
                  maxLength={40}
                  onChange={(event) => setApplicantName(event.target.value)}
                  placeholder="필명도 좋아요"
                  value={applicantName}
                />
              </label>
              <label className="field">
                <span>책 제목</span>
                <input
                  maxLength={80}
                  onChange={(event) => setBookTitle(event.target.value)}
                  placeholder="표지에 들어갈 제목"
                  value={bookTitle}
                />
              </label>
              <div className="studio-number-title">
                <label className="field">
                  <span>판형</span>
                  <select
                    onChange={(event) =>
                      setBookSize(event.target.value === "B5" ? "B5" : "A5")
                    }
                    value={bookSize}
                  >
                    <option value="A5">A5 (148×210mm)</option>
                    <option value="B5">B5 (182×257mm)</option>
                  </select>
                </label>
                <label className="field">
                  <span>표지</span>
                  <select
                    onChange={(event) =>
                      setCoverType(
                        event.target.value === "hardcover"
                          ? "hardcover"
                          : "softcover",
                      )
                    }
                    value={coverType}
                  >
                    <option value="softcover">소프트커버</option>
                    <option value="hardcover">하드커버</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>수량</span>
                <input
                  max={500}
                  min={1}
                  onChange={(event) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(500, Number(event.target.value) || 1),
                      ),
                    )
                  }
                  type="number"
                  value={quantity}
                />
              </label>
              <label className="field">
                <span>요청 메모 (선택)</span>
                <textarea
                  maxLength={500}
                  onChange={(event) => setPackagingMemo(event.target.value)}
                  placeholder="종이, 후가공 등 요청 사항"
                  rows={3}
                  value={packagingMemo}
                />
              </label>
            </section>
          ) : null}

          <div className="studio-safety-note">
            <strong>업로드 기준</strong>
            <ul>
              <li>ZIP/CBZ 최대 25MB, 이미지 최대 80장</li>
              <li>PNG, JPG, JPEG, WebP만 지원</li>
              <li>SVG와 실행 가능한 파일은 등록 불가</li>
              <li>미리보기 파일은 1시간 뒤 자동 만료</li>
            </ul>
          </div>
        </aside>

        <section className="studio-workspace">
          {seasonUnavailable ? (
            <section className="orders-empty">
              <h2>연재 중인 시즌이 없어요.</h2>
              <p>
                새 에피소드는 연재 중인 시즌에만 등록할 수 있습니다. 책
                패키징 신청은 시즌 없이도 이용할 수 있어요.
              </p>
            </section>
          ) : null}

          {replaceTarget ? (
            <div className="studio-replace-notice" role="status">
              <div>
                <strong>
                  {replaceTarget.number}화 · {replaceTarget.title} — 원고 교체
                  중
                </strong>
                <span>
                  ZIP/CBZ를 올리고 순서를 확인하면 기존 페이지가 새 원고로
                  모두 바뀝니다.
                </span>
              </div>
              <button
                className="button button--ghost"
                onClick={() => setReplaceTarget(null)}
                type="button"
              >
                교체 취소
              </button>
            </div>
          ) : null}

          {!seasonUnavailable &&
          !preview &&
          !created &&
          !packagingResult &&
          !replaceResult ? (
            <div
              className={`upload-dropzone ${dragging ? "upload-dropzone--dragging" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <span className="upload-dropzone__icon">ZIP</span>
              <h2>
                {busy === "upload"
                  ? "페이지 순서를 확인하고 있어요…"
                  : "원고 묶음을 여기에 놓으세요."}
              </h2>
              <p>파일명은 1, 2, 10처럼 자연스럽게 정렬됩니다.</p>
              <button
                className="button button--primary"
                disabled={busy !== null}
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                ZIP/CBZ 선택
              </button>
              <input
                accept=".zip,.cbz,application/zip"
                hidden
                onChange={onFileChange}
                ref={fileInput}
                type="file"
              />
            </div>
          ) : null}

          {preview ? (
            <>
              <header className="preview-header">
                <div>
                  <p className="eyebrow">Page preview</p>
                  <h2>{preview.originalName}</h2>
                  <p>{preview.pages.length}장의 순서를 확인해 주세요.</p>
                </div>
                <button
                  className="button button--ghost"
                  disabled={busy !== null}
                  onClick={() => fileInput.current?.click()}
                  type="button"
                >
                  다른 파일 선택
                </button>
                <input
                  accept=".zip,.cbz,application/zip"
                  hidden
                  onChange={onFileChange}
                  ref={fileInput}
                  type="file"
                />
              </header>
              <ol className="page-preview-list">
                {preview.pages.map((page, index) => (
                  <li key={page.id}>
                    <span className="page-preview-list__number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Image
                      alt={`${index + 1}번째 페이지 미리보기`}
                      height={180}
                      src={page.previewUrl}
                      unoptimized
                      width={120}
                    />
                    <div>
                      <strong>{page.originalName}</strong>
                      <span>{formatBytes(page.byteSize)}</span>
                    </div>
                    <div className="page-order-actions">
                      <button
                        aria-label={`${page.originalName} 앞으로 이동`}
                        disabled={index === 0}
                        onClick={() => movePage(index, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`${page.originalName} 뒤로 이동`}
                        disabled={index === preview.pages.length - 1}
                        onClick={() => movePage(index, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="studio-publish-bar">
                {replaceTarget ? (
                  <>
                    <div>
                      <strong>
                        {replaceTarget.number}화 · {replaceTarget.title}
                      </strong>
                      <span>
                        기존 페이지가 새 원고 {preview.pages.length}쪽으로
                        교체됩니다.
                      </span>
                    </div>
                    <button
                      className="button button--primary"
                      disabled={busy !== null}
                      onClick={() => void submitReplacePages()}
                      type="button"
                    >
                      {busy === "publish" ? "교체 중…" : "원고 교체"}
                    </button>
                  </>
                ) : purpose === "packaging" ? (
                  <>
                    <div>
                      <strong>
                        {bookSize} ·{" "}
                        {coverType === "hardcover"
                          ? "하드커버"
                          : "소프트커버"}{" "}
                        · {quantity}부
                      </strong>
                      <span>
                        내지 {preview.pages.length}쪽으로 패키징을 신청합니다.
                      </span>
                    </div>
                    <button
                      className="button button--primary"
                      disabled={busy !== null}
                      onClick={() => void submitPackagingRequest()}
                      type="button"
                    >
                      {busy === "publish" ? "접수 중…" : "패키징 신청"}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>
                        시즌 {selectedSeason?.number} · {episodeNumber}화
                      </strong>
                      <span>
                        {preview.pages.length}개 페이지를{" "}
                        {purpose === "draft" ? "비공개로 보관" : "등록"}
                        합니다.
                      </span>
                    </div>
                    <button
                      className="button button--primary"
                      disabled={busy !== null}
                      onClick={() => void publishEpisode()}
                      type="button"
                    >
                      {busy === "publish"
                        ? purpose === "draft"
                          ? "보관 중…"
                          : "등록 중…"
                        : purpose === "draft"
                          ? "비공개로 보관"
                          : "에피소드 등록"}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}

          {created ? (
            <div className="studio-success">
              <span>✓</span>
              {created.visibility === "private" ? (
                <>
                  <p className="eyebrow">Saved privately</p>
                  <h2>에피소드를 비공개로 보관했어요.</h2>
                  <p>
                    {created.pageCount}장의 페이지가 저장되었습니다. 목록과
                    피드에는 나오지 않고, 아래 링크를 아는 사람만 볼 수
                    있어요.
                  </p>
                </>
              ) : (
                <>
                  <p className="eyebrow">Published</p>
                  <h2>새 에피소드가 독자에게 열렸어요.</h2>
                  <p>{created.pageCount}장의 페이지가 순서대로 등록되었습니다.</p>
                </>
              )}
              <div>
                <Link className="button button--primary" href={created.readerUrl}>
                  {created.visibility === "private"
                    ? "비공개 미리보기"
                    : "등록한 에피소드 보기"}
                </Link>
                <button
                  className="button button--ghost"
                  onClick={() => {
                    setCreated(null);
                    setTitle("");
                    // 추천 번호가 방금 발행분을 반영하므로 파생값으로 복귀
                    setEpisodeNumberOverride(null);
                  }}
                  type="button"
                >
                  다음 에피소드 등록
                </button>
              </div>
            </div>
          ) : null}

          {packagingResult ? (
            <div className="studio-success">
              <span>✓</span>
              <p className="eyebrow">Packaging requested</p>
              <h2>책 패키징 신청을 접수했어요.</h2>
              <p>
                《{packagingResult.bookTitle}》 · 내지{" "}
                {packagingResult.pageCount}쪽 · {packagingResult.bookSize} ·{" "}
                {packagingResult.coverType === "hardcover"
                  ? "하드커버"
                  : "소프트커버"}{" "}
                {packagingResult.quantity}부. 담당자가 원고를 확인한 뒤
                진행 상황을 아래 신청 내역에서 알려드릴게요.
              </p>
              <div>
                <button
                  className="button button--ghost"
                  onClick={() => setPackagingResult(null)}
                  type="button"
                >
                  새 원고 올리기
                </button>
              </div>
            </div>
          ) : null}

          {replaceResult ? (
            <div className="studio-success">
              <span>✓</span>
              <p className="eyebrow">Pages replaced</p>
              <h2>원고를 새 파일로 교체했어요.</h2>
              <p>
                {replaceResult.pageCount}장의 페이지가 순서대로 다시
                등록되었고, 이전 원고 파일은 정리했습니다.
              </p>
              <div>
                <Link
                  className="button button--primary"
                  href={replaceResult.readerUrl}
                >
                  교체된 에피소드 보기
                </Link>
                <button
                  className="button button--ghost"
                  onClick={() => setReplaceResult(null)}
                  type="button"
                >
                  새 원고 올리기
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="studio-error" role="alert">{error}</p>
          ) : null}
        </section>
      </div>


      {purpose === "publish" &&
      selectedSeries &&
      selectedSeason &&
      selectedSeason.episodes.length > 0 ? (
        <StudioEpisodeManager
          deleteBusyId={deleteBusyId}
          deleteConfirmId={deleteConfirmId}
          deletedEpisodeIds={deletedEpisodeIds}
          episodeOverrides={episodeOverrides}
          episodes={selectedSeason.episodes}
          onDeleteClick={handleDeleteClick}
          onRenameCancel={() => setRenameTarget(null)}
          onRenameChange={setRenameTarget}
          onRenameSave={() => void saveRename()}
          onRenameStart={setRenameTarget}
          onReplaceStart={startReplace}
          renameBusy={renameBusy}
          renameMessage={renameMessage}
          renameTarget={renameTarget}
          seasonNumber={selectedSeason.number}
          seriesTitle={displayedSeriesTitle}
        />
      ) : null}

      {purpose === "draft" ? (
        <StudioDraftsShelf
          deleteBusyId={deleteBusyId}
          deleteConfirmId={deleteConfirmId}
          draftBusyId={draftBusyId}
          draftMessage={draftMessage}
          drafts={drafts}
          draftsState={draftsState}
          onDeleteClick={handleDeleteClick}
          onPublishDraft={(episodeId) => void publishDraft(episodeId)}
          onRenameCancel={() => setRenameTarget(null)}
          onRenameChange={setRenameTarget}
          onRenameSave={() => void saveRename()}
          onRenameStart={setRenameTarget}
          onReplaceStart={startReplace}
          onRetry={retryCollections}
          renameBusy={renameBusy}
          renameTarget={renameTarget}
        />
      ) : null}

      {purpose === "packaging" ? (
        <StudioPackagingHistory
          onRetry={retryCollections}
          requests={packagingRequests}
          state={packagingRequestsState}
        />
      ) : null}
    </main>
  );
}

function idempotencyKeyFor(
  attempt: { current: IdempotentAttempt | null },
  payload: unknown,
): string {
  const fingerprint = JSON.stringify(payload);
  if (attempt.current?.fingerprint !== fingerprint) {
    attempt.current = {
      fingerprint,
      requestKey: crypto.randomUUID(),
    };
  }
  return attempt.current.requestKey;
}
