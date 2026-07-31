"use client";

import Link from "next/link";
import type { EpisodeSummary } from "@/lib/reader-types";

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
  seasonNumber,
  seriesTitle,
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
  seasonNumber: number;
  seriesTitle: string;
}) {
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
          {seriesTitle} · 시즌 {seasonNumber} — 압축 파일명은 페이지 정렬에만
          쓰이며, 제목은 여기서 언제든 고칠 수 있어요.
        </p>
      </header>
      {renameMessage ? <p aria-live="polite">{renameMessage}</p> : null}
      <ul>
        {episodes
          .filter((episode) => !deletedEpisodeIds.has(episode.id))
          .map((episode) => {
            const display = {
              id: episode.id,
              number: episodeOverrides[episode.id]?.number ?? episode.number,
              title: episodeOverrides[episode.id]?.title ?? episode.title,
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
                    <div>
                      <strong>{display.number}화</strong>
                      <span>{display.title}</span>
                    </div>
                    <div className="studio-drafts__actions">
                      <Link
                        className="button button--ghost"
                        href={`/read/${encodeURIComponent(episode.id)}`}
                      >
                        보기
                      </Link>
                      <button
                        className="button button--ghost"
                        onClick={() => onReplaceStart(display)}
                        type="button"
                      >
                        원고 교체
                      </button>
                      <button
                        className="button button--primary"
                        onClick={() => onRenameStart(display)}
                        type="button"
                      >
                        정보 수정
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
                            : "삭제"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
