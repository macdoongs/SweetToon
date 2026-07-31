"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EpisodeSummary } from "@/lib/reader-types";

const EPISODES_PER_PAGE = 12;

export type EpisodeRenameTarget = {
  id: string;
  number: number;
  title: string;
};

export function EpisodeRenameForm({
  onCancel,
  onChange,
  onSave,
  renameBusy,
  renameTarget,
}: {
  onCancel: () => void;
  onChange: (next: EpisodeRenameTarget) => void;
  onSave: () => void;
  renameBusy: boolean;
  renameTarget: EpisodeRenameTarget;
}) {
  return (
    <>
      <label className="field studio-rename-number">
        <span>회차 번호</span>
        <input
          min={1}
          onChange={(event) =>
            onChange({
              ...renameTarget,
              number: Number(event.target.value),
            })
          }
          type="number"
          value={renameTarget.number}
        />
      </label>
      <label className="field studio-rename-field">
        <span>에피소드 제목</span>
        <input
          maxLength={80}
          onChange={(event) =>
            onChange({ ...renameTarget, title: event.target.value })
          }
          value={renameTarget.title}
        />
      </label>
      <div className="studio-drafts__actions">
        <button
          className="button button--ghost"
          disabled={renameBusy}
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="button button--primary"
          disabled={renameBusy}
          onClick={onSave}
          type="button"
        >
          {renameBusy ? "저장 중…" : "저장"}
        </button>
      </div>
    </>
  );
}

export function StudioEpisodeManager({
  deleteBusyId,
  deleteConfirmId,
  deletedEpisodeIds,
  episodeOverrides,
  episodes,
  onDeleteClick,
  onRenameCancel,
  onRenameChange,
  onRenameSave,
  onRenameStart,
  onReplaceStart,
  renameBusy,
  renameMessage,
  renameTarget,
  seasonId,
  seasonNumber,
  seasonOptions,
  seriesTitle,
  onSeasonChange,
}: {
  deleteBusyId: string | null;
  deleteConfirmId: string | null;
  deletedEpisodeIds: Set<string>;
  episodeOverrides: Record<string, { title: string; number: number }>;
  episodes: EpisodeSummary[];
  onDeleteClick: (episodeId: string) => void;
  onRenameCancel: () => void;
  onRenameChange: (next: EpisodeRenameTarget) => void;
  onRenameSave: () => void;
  onRenameStart: (target: EpisodeRenameTarget) => void;
  onReplaceStart: (target: EpisodeRenameTarget) => void;
  renameBusy: boolean;
  renameMessage: string | null;
  renameTarget: EpisodeRenameTarget | null;
  seasonId: string;
  seasonNumber: number;
  seasonOptions: Array<{
    episodeCount: number;
    id: string;
    number: number;
    status: "ongoing" | "completed";
    title: string | null;
  }>;
  seriesTitle: string;
  onSeasonChange: (seasonId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [volume, setVolume] = useState("all");
  const [sort, setSort] = useState<"latest" | "oldest">("latest");
  const [page, setPage] = useState(1);
  const availableEpisodes = useMemo(
    () =>
      episodes
        .filter((episode) => !deletedEpisodeIds.has(episode.id))
        .map((episode) => ({
          ...episode,
          number: episodeOverrides[episode.id]?.number ?? episode.number,
          title: episodeOverrides[episode.id]?.title ?? episode.title,
        })),
    [deletedEpisodeIds, episodeOverrides, episodes],
  );
  const volumeOptions = useMemo(
    () =>
      [...new Set(availableEpisodes.map((episode) => episode.volumeNumber))]
        .sort((left, right) => left - right),
    [availableEpisodes],
  );
  const filteredEpisodes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return availableEpisodes
      .filter(
        (episode) =>
          volume === "all" || episode.volumeNumber === Number(volume),
      )
      .filter(
        (episode) =>
          normalizedQuery.length === 0 ||
          String(episode.number).includes(normalizedQuery) ||
          episode.title.toLocaleLowerCase("ko-KR").includes(normalizedQuery),
      )
      .sort((left, right) =>
        sort === "latest"
          ? right.number - left.number
          : left.number - right.number,
      );
  }, [availableEpisodes, query, sort, volume]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredEpisodes.length / EPISODES_PER_PAGE),
  );
  const activePage = Math.min(page, pageCount);
  const pageStart = (activePage - 1) * EPISODES_PER_PAGE;
  const visibleEpisodes = filteredEpisodes.slice(
    pageStart,
    pageStart + EPISODES_PER_PAGE,
  );

  function resetFilters() {
    setQuery("");
    setVolume("all");
    setSort("latest");
    setPage(1);
  }

  function formatPublishedAt(value: string) {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeZone: "Asia/Seoul",
    }).format(new Date(value));
  }

  return (
    <section
      className="studio-drafts studio-episodes"
      aria-label="등록된 회차 관리"
    >
      <header>
        <div>
          <p className="eyebrow">Episodes</p>
          <h2>등록된 회차 관리</h2>
        </div>
        <p>
          {seriesTitle}의 공개 회차를 시즌과 권 단위로 찾아 관리합니다.
        </p>
      </header>
      {renameMessage ? <p aria-live="polite">{renameMessage}</p> : null}
      <div className="studio-episodes__toolbar">
        <label className="field">
          <span>관리할 시즌</span>
          <select
            onChange={(event) => {
              onSeasonChange(event.target.value);
              resetFilters();
            }}
            value={seasonId}
          >
            {seasonOptions.map((season) => (
              <option key={season.id} value={season.id}>
                시즌 {season.number}
                {season.title ? ` · ${season.title}` : ""} ·{" "}
                {season.status === "completed" ? "완결" : "연재 중"} ·{" "}
                {season.episodeCount}화
              </option>
            ))}
          </select>
        </label>
        <label className="field studio-episodes__search">
          <span>회차 검색</span>
          <input
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="번호 또는 제목"
            type="search"
            value={query}
          />
        </label>
        <label className="field">
          <span>소장본 권</span>
          <select
            onChange={(event) => {
              setVolume(event.target.value);
              setPage(1);
            }}
            value={volume}
          >
            <option value="all">전체 권</option>
            {volumeOptions.map((volumeNumber) => (
              <option key={volumeNumber} value={volumeNumber}>
                {volumeNumber}권
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>정렬</span>
          <select
            onChange={(event) => {
              setSort(event.target.value as "latest" | "oldest");
              setPage(1);
            }}
            value={sort}
          >
            <option value="latest">최신 회차부터</option>
            <option value="oldest">첫 회차부터</option>
          </select>
        </label>
      </div>
      <div className="studio-episodes__summary" role="status">
        <strong>시즌 {seasonNumber}</strong>
        <span>
          전체 {availableEpisodes.length}화 · 조건에 맞는 회차{" "}
          {filteredEpisodes.length}개
        </span>
      </div>
      {visibleEpisodes.length === 0 ? (
        <div className="studio-episodes__empty">
          <h3>
            {availableEpisodes.length === 0
              ? "이 시즌에 등록된 공개 회차가 없어요."
              : "조건에 맞는 회차가 없어요."}
          </h3>
          {availableEpisodes.length > 0 ? (
            <button
              className="button button--ghost"
              onClick={resetFilters}
              type="button"
            >
              검색 조건 초기화
            </button>
          ) : null}
        </div>
      ) : (
        <ul>
          {visibleEpisodes.map((episode) => {
            const display = {
              id: episode.id,
              number: episode.number,
              title: episode.title,
            };
            return (
              <li key={episode.id}>
                {renameTarget?.id === episode.id ? (
                  <EpisodeRenameForm
                    onCancel={onRenameCancel}
                    onChange={onRenameChange}
                    onSave={onRenameSave}
                    renameBusy={renameBusy}
                    renameTarget={renameTarget}
                  />
                ) : (
                  <>
                    <div className="studio-episode-row__identity">
                      <div>
                        <strong>{display.number}화</strong>
                        <span>{display.title}</span>
                      </div>
                      <small>
                        {episode.volumeNumber}권 ·{" "}
                        {episode.access === "free" ? "무료 공개" : "잠긴 회차"} ·{" "}
                        <time dateTime={episode.publishedAt}>
                          {formatPublishedAt(episode.publishedAt)}
                        </time>
                      </small>
                    </div>
                    <div className="studio-episode-row__actions">
                      <Link
                        className="button button--ghost"
                        href={`/read/${encodeURIComponent(episode.id)}`}
                      >
                        보기
                      </Link>
                      <details className="studio-episode-actions-menu">
                        <summary
                          aria-label={`${display.number}화 관리 메뉴`}
                          className="button button--primary"
                        >
                          관리
                        </summary>
                        <div>
                          <button
                            className="button button--ghost"
                            onClick={() => onRenameStart(display)}
                            type="button"
                          >
                            정보 수정
                          </button>
                          <button
                            className="button button--ghost"
                            onClick={() => onReplaceStart(display)}
                            type="button"
                          >
                            원고 교체
                          </button>
                          <button
                            className="button button--danger"
                            disabled={deleteBusyId !== null}
                            onClick={() => onDeleteClick(episode.id)}
                            type="button"
                          >
                            {deleteBusyId === episode.id
                              ? "삭제 중…"
                              : deleteConfirmId === episode.id
                                ? "정말 삭제"
                                : "회차 삭제"}
                          </button>
                        </div>
                      </details>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {filteredEpisodes.length > EPISODES_PER_PAGE ? (
        <footer className="studio-episodes__pagination">
          <span>
            {pageStart + 1}–
            {Math.min(
              pageStart + EPISODES_PER_PAGE,
              filteredEpisodes.length,
            )}
            번째 표시
          </span>
          <nav aria-label="등록 회차 페이지">
            <button
              className="button button--ghost"
              disabled={activePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              이전
            </button>
            <strong>
              {activePage} / {pageCount}
            </strong>
            <button
              className="button button--ghost"
              disabled={activePage === pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              type="button"
            >
              다음
            </button>
          </nav>
        </footer>
      ) : null}
    </section>
  );
}
