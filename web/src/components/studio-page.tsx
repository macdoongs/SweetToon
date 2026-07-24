"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  deleteRequest,
  postFormData,
  postJson,
} from "@/lib/api";
import type { SeriesDetail } from "@/lib/reader-types";
import type {
  CreatedEpisode,
  CreateEpisodeRequest,
  UploadPreview,
} from "@/lib/studio-types";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function StudioPage({ series }: { series: SeriesDetail[] }) {
  const availableSeries = useMemo(
    () =>
      series.filter((item) =>
        item.seasons.some((season) => season.status === "ongoing"),
      ),
    [series],
  );
  const [seriesId, setSeriesId] = useState(availableSeries[0]?.id ?? "");
  const selectedSeries =
    availableSeries.find((item) => item.id === seriesId) ??
    availableSeries[0];
  const ongoingSeasons =
    selectedSeries?.seasons.filter((season) => season.status === "ongoing") ??
    [];
  const [seasonId, setSeasonId] = useState(ongoingSeasons[0]?.id ?? "");
  const selectedSeason =
    ongoingSeasons.find((season) => season.id === seasonId) ??
    ongoingSeasons[0];
  const suggestedNumber = selectedSeason
    ? Math.max(0, ...selectedSeason.episodes.map((episode) => episode.number)) +
      1
    : 1;

  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState(suggestedNumber);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedEpisode | null>(null);

  function chooseSeries(nextSeriesId: string) {
    const nextSeries = availableSeries.find(
      (item) => item.id === nextSeriesId,
    );
    const nextSeason = nextSeries?.seasons.find(
      (season) => season.status === "ongoing",
    );
    setSeriesId(nextSeriesId);
    setSeasonId(nextSeason?.id ?? "");
    setEpisodeNumber(
      nextSeason
        ? Math.max(
            0,
            ...nextSeason.episodes.map((episode) => episode.number),
          ) + 1
        : 1,
    );
  }

  function chooseSeason(nextSeasonId: string) {
    const nextSeason = ongoingSeasons.find(
      (season) => season.id === nextSeasonId,
    );
    setSeasonId(nextSeasonId);
    setEpisodeNumber(
      nextSeason
        ? Math.max(
            0,
            ...nextSeason.episodes.map((episode) => episode.number),
          ) + 1
        : 1,
    );
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
      ).catch(() => undefined);
    }
    setBusy("upload");
    setError(null);
    setCreated(null);
    const formData = new FormData();
    formData.append("archive", file);
    try {
      const result = await postFormData<UploadPreview>(
        "/api/studio/uploads",
        formData,
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
    if (title.trim().length === 0) {
      setError("에피소드 제목을 입력해 주세요.");
      return;
    }
    setBusy("publish");
    setError(null);
    try {
      const result = await postJson<CreateEpisodeRequest, CreatedEpisode>(
        "/api/studio/episodes",
        {
          sessionId: preview.sessionId,
          seasonId: selectedSeason.id,
          number: episodeNumber,
          title: title.trim(),
          pageIds: preview.pages.map((page) => page.id),
        },
      );
      setCreated(result);
      setPreview(null);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "에피소드를 등록하지 못했습니다.",
      );
    } finally {
      setBusy(null);
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
          작업 폴더의 이미지를 ZIP 또는 CBZ로 묶어 올리세요. 파일명 순서대로
          펼쳐 보고, 필요한 순서만 다듬은 뒤 등록할 수 있습니다.
        </p>
      </header>

      {availableSeries.length === 0 ? (
        <section className="orders-empty">
          <h2>연재 중인 시즌이 없어요.</h2>
          <p>새 에피소드는 연재 중인 시즌에만 등록할 수 있습니다.</p>
        </section>
      ) : (
        <div className="studio-layout">
          <aside className="studio-settings">
            <p className="eyebrow">Episode info</p>
            <label className="field">
              <span>작품</span>
              <select
                onChange={(event) => chooseSeries(event.target.value)}
                value={selectedSeries?.id}
              >
                {availableSeries.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
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
                    setEpisodeNumber(Number(event.target.value))
                  }
                  type="number"
                  value={episodeNumber}
                />
              </label>
              <label className="field">
                <span>제목</span>
                <input
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`${episodeNumber}화`}
                  value={title}
                />
              </label>
            </div>
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
            {!preview && !created ? (
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
                  <div>
                    <strong>
                      시즌 {selectedSeason?.number} · {episodeNumber}화
                    </strong>
                    <span>{preview.pages.length}개 페이지로 등록됩니다.</span>
                  </div>
                  <button
                    className="button button--primary"
                    disabled={busy !== null}
                    onClick={publishEpisode}
                    type="button"
                  >
                    {busy === "publish" ? "등록 중…" : "에피소드 등록"}
                  </button>
                </div>
              </>
            ) : null}

            {created ? (
              <div className="studio-success">
                <span>✓</span>
                <p className="eyebrow">Published</p>
                <h2>새 에피소드가 독자에게 열렸어요.</h2>
                <p>{created.pageCount}장의 페이지가 순서대로 등록되었습니다.</p>
                <div>
                  <Link className="button button--primary" href={created.readerUrl}>
                    등록한 에피소드 보기
                  </Link>
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      setCreated(null);
                      setTitle("");
                      setEpisodeNumber((current) => current + 1);
                    }}
                    type="button"
                  >
                    다음 에피소드 등록
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="studio-error" role="alert">{error}</p>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
