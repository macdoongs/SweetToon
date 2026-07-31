"use client";

import Link from "next/link";
import type { DraftEpisode } from "@/lib/studio-types";
import type { StudioCollectionState } from "@/lib/use-studio-collections";
import {
  EpisodeRenameForm,
  type EpisodeRenameTarget,
} from "./studio-episode-manager";

export function StudioDraftsShelf({
  deleteBusyId,
  deleteConfirmId,
  draftBusyId,
  draftMessage,
  drafts,
  draftsState,
  onDeleteClick,
  onPublishDraft,
  onRenameCancel,
  onRenameChange,
  onRenameSave,
  onRenameStart,
  onReplaceStart,
  onRetry,
  renameBusy,
  renameTarget,
}: {
  deleteBusyId: string | null;
  deleteConfirmId: string | null;
  draftBusyId: string | null;
  draftMessage: string | null;
  drafts: DraftEpisode[];
  draftsState: StudioCollectionState;
  onDeleteClick: (episodeId: string) => void;
  onPublishDraft: (episodeId: string) => void;
  onRenameCancel: () => void;
  onRenameChange: (next: EpisodeRenameTarget) => void;
  onRenameSave: () => void;
  onRenameStart: (target: EpisodeRenameTarget) => void;
  onReplaceStart: (target: EpisodeRenameTarget) => void;
  onRetry: () => void;
  renameBusy: boolean;
  renameTarget: EpisodeRenameTarget | null;
}) {
  if (draftsState === "loading") {
    return (
      <section className="studio-drafts" aria-busy="true">
        <h2>비공개 보관함을 불러오는 중…</h2>
      </section>
    );
  }
  if (draftsState === "error") {
    return (
      <section className="studio-drafts" role="alert">
        <h2>비공개 보관함을 불러오지 못했어요.</h2>
        <button
          className="button button--ghost"
          onClick={onRetry}
          type="button"
        >
          다시 시도
        </button>
      </section>
    );
  }
  if (drafts.length === 0) {
    return (
      <section className="studio-drafts">
        <h2>비공개로 보관한 회차가 없어요.</h2>
        <p>원고 업로드 목적에서 ‘비공개 보관’을 선택해 추가할 수 있어요.</p>
      </section>
    );
  }
  return (
    <section className="studio-drafts" aria-label="비공개 보관함">
      <header>
        <div>
          <p className="eyebrow">Private shelf</p>
          <h2>비공개 보관함</h2>
        </div>
        <p>링크를 아는 사람만 볼 수 있어요. 준비되면 공개로 전환하세요.</p>
      </header>
      {draftMessage ? <p aria-live="polite">{draftMessage}</p> : null}
      <ul>
        {drafts.map((draft) => (
          <li key={draft.id}>
            {renameTarget?.id === draft.id ? (
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
                  <strong>
                    {draft.series.title} · 시즌 {draft.season.number} ·{" "}
                    {draft.number}화
                  </strong>
                  <span>{draft.title}</span>
                </div>
                <div className="studio-drafts__actions">
                  <Link
                    className="button button--ghost"
                    href={`/read/${encodeURIComponent(draft.id)}`}
                  >
                    미리보기
                  </Link>
                  <button
                    className="button button--ghost"
                    onClick={() =>
                      onRenameStart({
                        id: draft.id,
                        number: draft.number,
                        title: draft.title,
                      })
                    }
                    type="button"
                  >
                    정보 수정
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() =>
                      onReplaceStart({
                        id: draft.id,
                        number: draft.number,
                        title: draft.title,
                      })
                    }
                    type="button"
                  >
                    원고 교체
                  </button>
                  <button
                    className="button button--primary"
                    disabled={draftBusyId !== null}
                    onClick={() => onPublishDraft(draft.id)}
                    type="button"
                  >
                    {draftBusyId === draft.id ? "공개 중…" : "공개하기"}
                  </button>
                  <button
                    className="button button--danger"
                    disabled={deleteBusyId !== null}
                    onClick={() => onDeleteClick(draft.id)}
                    type="button"
                  >
                    {deleteBusyId === draft.id
                      ? "삭제 중…"
                      : deleteConfirmId === draft.id
                        ? "정말 삭제"
                        : "삭제"}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
