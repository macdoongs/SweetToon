"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ApiError,
  deleteRequest,
  patchJson,
  postFormData,
  postJson,
} from "@/lib/api";
import type { SeriesDetail } from "@/lib/reader-types";
import { studioHeaders } from "@/lib/studio-headers";
import type {
  AccessPolicy,
  AccessPolicyResponse,
  DraftEpisode,
  SeriesInfoResponse,
  StudioSeasonResponse,
  UpdateSeriesInfoRequest,
} from "@/lib/studio-types";
import {
  StudioEpisodeManager,
  type EpisodeRenameTarget,
} from "./studio-episode-manager";

const EMPTY_OVERRIDES: Record<string, { title: string; number: number }> = {};
const EMPTY_DELETED = new Set<string>();

export function StudioSeriesManagePage({ detail }: { detail: SeriesDetail }) {
  const router = useRouter();
  const [seriesEdit, setSeriesEdit] = useState<
    { title: string; synopsis: string } | null
  >(null);
  const [seriesEditBusy, setSeriesEditBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [seriesEditMessage, setSeriesEditMessage] = useState<string | null>(
    null,
  );
  const [policyEdit, setPolicyEdit] = useState<AccessPolicy | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [seasonBusyId, setSeasonBusyId] = useState<string | null>(null);
  const [seasonMessage, setSeasonMessage] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] =
    useState<EpisodeRenameTarget | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  // 편집 중 값이 없으면 서버 상세의 현재 값을 그대로 쓴다.
  const policy = policyEdit ?? {
    freeVolumeCount: detail.freeVolumeCount,
    previewEpisodeCount: detail.previewEpisodeCount,
  };
  const editTitle = seriesEdit?.title ?? detail.title;
  const editSynopsis = seriesEdit?.synopsis ?? detail.synopsis;
  const ongoingSeasons = detail.seasons.filter(
    (season) => season.status === "ongoing",
  );
  const managedSeason = ongoingSeasons[0] ?? detail.seasons.at(-1);

  async function saveSeriesInfo() {
    const nextTitle = editTitle.trim();
    const nextSynopsis = editSynopsis.trim();
    if (nextTitle.length === 0 || nextSynopsis.length === 0) {
      setSeriesEditMessage("제목과 줄거리를 비워 둘 수 없어요.");
      return;
    }
    setSeriesEditBusy(true);
    setSeriesEditMessage(null);
    try {
      await patchJson<UpdateSeriesInfoRequest, SeriesInfoResponse>(
        `/api/studio/series/${encodeURIComponent(detail.id)}`,
        { title: nextTitle, synopsis: nextSynopsis },
        studioHeaders(),
      );
      setSeriesEdit(null);
      setSeriesEditMessage(
        "작품 정보를 저장했어요. 독자 주소(slug)는 그대로 유지됩니다.",
      );
      router.refresh();
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

  async function uploadCover(file: File | undefined) {
    if (!file) return;
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
        `/api/studio/series/${encodeURIComponent(detail.id)}/cover`,
        formData,
        studioHeaders(),
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

  async function saveAccessPolicy() {
    if (
      !Number.isInteger(policy.freeVolumeCount) ||
      policy.freeVolumeCount < 0 ||
      policy.freeVolumeCount > 20
    ) {
      setPolicyMessage("무료 공개 권수는 0에서 20 사이 숫자여야 해요.");
      return;
    }
    setPolicyBusy(true);
    setPolicyMessage(null);
    try {
      await patchJson<AccessPolicy, AccessPolicyResponse>(
        `/api/studio/series/${encodeURIComponent(detail.id)}/access-policy`,
        policy,
        studioHeaders(),
      );
      setPolicyEdit(null);
      setPolicyMessage("독자 공개 범위를 저장했어요.");
      router.refresh();
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
        studioHeaders(),
      );
      setSeasonMessage(
        updated.status === "completed"
          ? `시즌 ${updated.number}을 완결 처리했어요. 이제 독자가 소장본을 주문할 수 있습니다.`
          : `시즌 ${updated.number} 연재를 다시 시작했어요.`,
      );
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
    setSeasonBusyId("new");
    setSeasonMessage(null);
    try {
      const created = await postJson<
        Record<string, never>,
        StudioSeasonResponse
      >(
        `/api/studio/series/${encodeURIComponent(detail.id)}/seasons`,
        {},
        undefined,
        studioHeaders(),
      );
      setSeasonMessage(`시즌 ${created.number} 연재를 시작했어요.`);
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
      await patchJson<{ title: string; number: number }, DraftEpisode>(
        `/api/studio/episodes/${encodeURIComponent(renameTarget.id)}`,
        { title: nextTitle, number: renameTarget.number },
        studioHeaders(),
      );
      setRenameTarget(null);
      setRenameMessage("에피소드 정보를 수정했어요.");
      router.refresh();
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

  async function removeEpisode(episodeId: string) {
    setDeleteBusyId(episodeId);
    try {
      await deleteRequest(
        `/api/studio/episodes/${encodeURIComponent(episodeId)}`,
        studioHeaders(),
      );
      setRenameMessage("에피소드와 원고 파일을 삭제했어요.");
      router.refresh();
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

  function handleDeleteClick(episodeId: string) {
    if (deleteConfirmId === episodeId) {
      void removeEpisode(episodeId);
    } else {
      setDeleteConfirmId(episodeId);
    }
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Series</p>
        <h1>{detail.title}</h1>
        <p>
          {detail.author.name} · {detail.genre} · 독자 주소 /series/
          {detail.slug}
        </p>
        <Link
          className="button button--primary"
          href={`/studio/series/${encodeURIComponent(detail.slug)}/episodes/new`}
        >
          새 회차 올리기
        </Link>
      </header>

      <div className="studio-manage-grid">
        <section className="studio-drafts" aria-label="작품 정보 수정">
          <header>
            <div>
              <p className="eyebrow">Info</p>
              <h2>작품 정보</h2>
            </div>
            <p>독자 주소(slug)는 바뀌지 않아요.</p>
          </header>
          <label className="field">
            <span>작품 제목</span>
            <input
              maxLength={80}
              onChange={(event) =>
                setSeriesEdit({
                  title: event.target.value,
                  synopsis: editSynopsis,
                })
              }
              value={editTitle}
            />
          </label>
          <label className="field">
            <span>줄거리</span>
            <textarea
              maxLength={1000}
              onChange={(event) =>
                setSeriesEdit({
                  title: editTitle,
                  synopsis: event.target.value,
                })
              }
              rows={4}
              value={editSynopsis}
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
          <p aria-live="polite">{seriesEditMessage ?? ""}</p>
        </section>

        <section className="studio-drafts" aria-label="시즌과 공개 범위">
          <header>
            <div>
              <p className="eyebrow">Seasons</p>
              <h2>시즌 관리</h2>
            </div>
            <p>
              완결된 시즌만 소장본 주문이 가능하고, 새 회차는 연재 중인
              시즌에만 올릴 수 있어요.
            </p>
          </header>
          <ul className="studio-season-manage__list">
            {detail.seasons.map((season) => (
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
          <p aria-live="polite">{seasonMessage ?? ""}</p>

          <div className="studio-access-policy">
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
                  setPolicyEdit({
                    ...policy,
                    freeVolumeCount: event.target.valueAsNumber || 0,
                  })
                }
                type="number"
                value={policy.freeVolumeCount}
              />
            </label>
            <label className="field">
              <span>다음 권 미리보기</span>
              <select
                onChange={(event) =>
                  setPolicyEdit({
                    ...policy,
                    previewEpisodeCount: Number(event.target.value),
                  })
                }
                value={policy.previewEpisodeCount}
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
            {policyMessage ? <p aria-live="polite">{policyMessage}</p> : null}
          </div>
        </section>
      </div>

      {managedSeason && managedSeason.episodes.length > 0 ? (
        <StudioEpisodeManager
          deleteBusyId={deleteBusyId}
          deleteConfirmId={deleteConfirmId}
          deletedEpisodeIds={EMPTY_DELETED}
          episodeOverrides={EMPTY_OVERRIDES}
          episodes={managedSeason.episodes}
          onDeleteClick={handleDeleteClick}
          onRenameCancel={() => setRenameTarget(null)}
          onRenameChange={setRenameTarget}
          onRenameSave={() => void saveRename()}
          onRenameStart={setRenameTarget}
          onReplaceStart={(target) =>
            router.push(
              `/studio/series/${encodeURIComponent(detail.slug)}/episodes/new?replace=${encodeURIComponent(target.id)}&number=${target.number}&title=${encodeURIComponent(target.title)}`,
            )
          }
          renameBusy={renameBusy}
          renameMessage={renameMessage}
          renameTarget={renameTarget}
          seasonNumber={managedSeason.number}
          seriesTitle={detail.title}
        />
      ) : null}
    </>
  );
}
