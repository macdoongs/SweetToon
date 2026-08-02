"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ApiError,
  isUncertainRequestError,
  patchJson,
  postJson,
} from "@/lib/api";
import type { SeriesDetail } from "@/lib/reader-types";
import { studioHeaders } from "@/lib/studio-headers";
import type {
  CreatedEpisode,
  CreateEpisodeRequest,
  UploadPreview,
} from "@/lib/studio-types";
import { useStudioCollections } from "@/lib/use-studio-collections";
import { StudioUploadWorkspace } from "./studio-upload-workspace";

type IdempotentAttempt = { fingerprint: string; requestKey: string };

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

export type ReplaceTarget = { id: string; number: number; title: string };

export function StudioEpisodeNewPage({
  detail,
  replaceTarget,
}: {
  detail: SeriesDetail;
  replaceTarget: ReplaceTarget | null;
}) {
  const router = useRouter();
  const { drafts } = useStudioCollections();
  const ongoingSeasons = detail.seasons.filter(
    (season) => season.status === "ongoing",
  );
  const [seasonId, setSeasonId] = useState(ongoingSeasons[0]?.id ?? "");
  const selectedSeason =
    ongoingSeasons.find((season) => season.id === seasonId) ??
    ongoingSeasons[0];
  const suggestedNumber = selectedSeason
    ? Math.max(
        0,
        ...selectedSeason.episodes.map((episode) => episode.number),
        ...drafts
          .filter((draft) => draft.season.id === selectedSeason.id)
          .map((draft) => draft.number),
      ) + 1
    : 1;
  const [numberOverride, setNumberOverride] = useState<number | null>(null);
  const episodeNumber = numberOverride ?? suggestedNumber;
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">(
    "public",
  );
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedEpisode | null>(null);
  const [replaceResult, setReplaceResult] = useState<CreatedEpisode | null>(
    null,
  );
  const episodeAttempt = useRef<IdempotentAttempt | null>(null);

  async function publishEpisode(currentPreview: UploadPreview) {
    if (!selectedSeason) return;
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
      setError("회차 번호는 1 이상의 숫자여야 해요.");
      return;
    }
    // 제목을 비워 두면 회차 번호로 자동 지정한다. 등록 뒤에도 수정할 수 있다.
    const resolvedTitle = title.trim() || `${episodeNumber}화`;
    const payload: Omit<CreateEpisodeRequest, "requestKey"> = {
      sessionId: currentPreview.sessionId,
      seasonId: selectedSeason.id,
      number: episodeNumber,
      title: resolvedTitle,
      pageIds: currentPreview.pages.map((page) => page.id),
      visibility,
    };
    const requestKey = idempotencyKeyFor(episodeAttempt, payload);
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<CreateEpisodeRequest, CreatedEpisode>(
        "/api/studio/episodes",
        { requestKey, ...payload },
        undefined,
        studioHeaders(),
      );
      episodeAttempt.current = null;
      setCreated(result);
      setPreview(null);
      router.refresh();
    } catch (reason) {
      if (!isUncertainRequestError(reason)) episodeAttempt.current = null;
      setError(
        reason instanceof ApiError
          ? reason.message
          : "에피소드를 등록하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitReplacePages(currentPreview: UploadPreview) {
    if (!replaceTarget) return;
    setBusy(true);
    setError(null);
    try {
      const result = await patchJson<
        { sessionId: string; pageIds: string[] },
        CreatedEpisode
      >(
        `/api/studio/episodes/${encodeURIComponent(replaceTarget.id)}/pages`,
        {
          sessionId: currentPreview.sessionId,
          pageIds: currentPreview.pages.map((page) => page.id),
        },
        studioHeaders(),
      );
      setReplaceResult(result);
      setPreview(null);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "원고를 교체하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  const seasonUnavailable = !replaceTarget && ongoingSeasons.length === 0;
  const manageHref = `/studio/series/${encodeURIComponent(detail.slug)}`;

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Upload</p>
        <h1>
          {replaceTarget
            ? "원고 한 묶음을 교체합니다."
            : "원고 한 묶음을 올립니다."}
        </h1>
        <p>
          {detail.title} ·{" "}
          {replaceTarget
            ? `${replaceTarget.number}화 · ${replaceTarget.title}`
            : "ZIP/CBZ 원고를 올려 순서를 확인하고 발행하세요."}
        </p>
        <Link className="operations-link" href={manageHref}>
          작품 관리로 돌아가기 →
        </Link>
      </header>

      {error ? (
        <p className="studio-error" role="alert">{error}</p>
      ) : null}

      {!replaceTarget && !created ? (
        <section className="studio-drafts" aria-label="발행 정보">
          <div className="studio-number-title">
            <label className="field">
              <span>시즌</span>
              <select
                onChange={(event) => {
                  setSeasonId(event.target.value);
                  setNumberOverride(null);
                }}
                value={selectedSeason?.id}
              >
                {ongoingSeasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    시즌 {season.number} · {season.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>회차</span>
              <input
                min={1}
                onChange={(event) =>
                  setNumberOverride(event.target.valueAsNumber || 0)
                }
                type="number"
                value={episodeNumber}
              />
            </label>
            <label className="field">
              <span>
                제목 <small>비우면 “{episodeNumber}화”로 저장돼요</small>
              </span>
              <input
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`${episodeNumber}화`}
                value={title}
              />
            </label>
          </div>
          <fieldset className="studio-purpose" aria-label="공개 범위">
            {(
              [
                ["public", "즉시 공개", "새 에피소드를 독자에게 바로 엽니다."],
                [
                  "private",
                  "비공개 보관",
                  "링크를 아는 사람만 볼 수 있게 임시로 보관합니다.",
                ],
              ] as const
            ).map(([value, label, description]) => (
              <label
                className={
                  visibility === value
                    ? "studio-purpose__option studio-purpose__option--active"
                    : "studio-purpose__option"
                }
                key={value}
              >
                <input
                  checked={visibility === value}
                  name="episode-visibility"
                  onChange={() => setVisibility(value)}
                  type="radio"
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      ) : null}

      <StudioUploadWorkspace
        busy={busy}
        hidden={Boolean(created || replaceResult || seasonUnavailable)}
        notice={
          seasonUnavailable ? (
            <section className="orders-empty">
              <h2>연재 중인 시즌이 없어요.</h2>
              <p>작품 관리에서 새 시즌을 시작한 뒤 회차를 올릴 수 있어요.</p>
              <Link className="button button--primary" href={manageHref}>
                작품 관리로 이동
              </Link>
            </section>
          ) : null
        }
        onPreviewChange={setPreview}
        onUploadError={setError}
        preview={preview}
        renderSubmitBar={(currentPreview) =>
          replaceTarget ? (
            <>
              <div>
                <strong>
                  {replaceTarget.number}화 · {replaceTarget.title}
                </strong>
                <span>
                  기존 페이지가 새 원고 {currentPreview.pages.length}쪽으로
                  교체됩니다.
                </span>
              </div>
              <button
                className="button button--primary"
                disabled={busy}
                onClick={() => void submitReplacePages(currentPreview)}
                type="button"
              >
                {busy ? "교체 중…" : "원고 교체"}
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>
                  시즌 {selectedSeason?.number} · {episodeNumber}화
                </strong>
                <span>
                  {currentPreview.pages.length}개 페이지를{" "}
                  {visibility === "private" ? "비공개로 보관" : "등록"}합니다.
                </span>
              </div>
              <button
                className="button button--primary"
                disabled={busy}
                onClick={() => void publishEpisode(currentPreview)}
                type="button"
              >
                {busy
                  ? visibility === "private"
                    ? "보관 중…"
                    : "등록 중…"
                  : visibility === "private"
                    ? "비공개로 보관"
                    : "에피소드 등록"}
              </button>
            </>
          )
        }
      />

      {created ? (
        <div className="studio-success">
          <span>✓</span>
          {created.visibility === "private" ? (
            <>
              <p className="eyebrow">Saved privately</p>
              <h2>에피소드를 비공개로 보관했어요.</h2>
              <p>
                {created.pageCount}장의 페이지가 저장되었습니다. 비공개
                보관함에서 언제든 공개로 전환할 수 있어요.
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
            {created.visibility === "private" ? (
              <Link className="button button--ghost" href="/studio/drafts">
                비공개 보관함 열기
              </Link>
            ) : null}
            <button
              className="button button--ghost"
              onClick={() => {
                setCreated(null);
                setTitle("");
                // 추천 번호가 방금 발행분을 반영하므로 파생값으로 복귀
                setNumberOverride(null);
              }}
              type="button"
            >
              다음 에피소드 등록
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
            {replaceResult.pageCount}장의 페이지가 순서대로 다시 등록되었고,
            이전 원고 파일은 정리했습니다.
          </p>
          <div>
            <Link
              className="button button--primary"
              href={replaceResult.readerUrl}
            >
              교체된 에피소드 보기
            </Link>
            <Link className="button button--ghost" href={manageHref}>
              작품 관리로 돌아가기
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
