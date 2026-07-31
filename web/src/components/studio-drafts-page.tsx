"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, deleteRequest, patchJson } from "@/lib/api";
import { studioHeaders } from "@/lib/studio-headers";
import type { DraftEpisode } from "@/lib/studio-types";
import { useStudioCollections } from "@/lib/use-studio-collections";
import { StudioDraftsShelf } from "./studio-drafts-shelf";
import type { EpisodeRenameTarget } from "./studio-episode-manager";

export function StudioDraftsPage() {
  const router = useRouter();
  const { drafts, setDrafts, draftsState, retry } = useStudioCollections();
  const [draftBusyId, setDraftBusyId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] =
    useState<EpisodeRenameTarget | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  async function publishDraft(episodeId: string) {
    setDraftBusyId(episodeId);
    setDraftMessage(null);
    try {
      await patchJson<{ visibility: "public" }, DraftEpisode>(
        `/api/studio/episodes/${encodeURIComponent(episodeId)}/visibility`,
        { visibility: "public" },
        studioHeaders(),
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

  async function saveRename() {
    if (!renameTarget) return;
    const nextTitle = renameTarget.title.trim();
    if (nextTitle.length === 0) {
      setDraftMessage("제목을 한 글자 이상 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(renameTarget.number) || renameTarget.number < 1) {
      setDraftMessage("회차 번호는 1 이상의 숫자여야 해요.");
      return;
    }
    setRenameBusy(true);
    setDraftMessage(null);
    try {
      const updated = await patchJson<
        { title: string; number: number },
        DraftEpisode
      >(
        `/api/studio/episodes/${encodeURIComponent(renameTarget.id)}`,
        { title: nextTitle, number: renameTarget.number },
        studioHeaders(),
      );
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === updated.id
            ? { ...draft, title: updated.title, number: updated.number }
            : draft,
        ),
      );
      setRenameTarget(null);
      setDraftMessage("에피소드 정보를 수정했어요.");
    } catch (reason) {
      setDraftMessage(
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
      setDrafts((current) =>
        current.filter((draft) => draft.id !== episodeId),
      );
      setDraftMessage("에피소드와 원고 파일을 삭제했어요.");
    } catch (reason) {
      setDraftMessage(
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

  function startReplace(target: EpisodeRenameTarget) {
    const draft = drafts.find((item) => item.id === target.id);
    if (!draft) return;
    router.push(
      `/studio/series/${encodeURIComponent(draft.series.slug)}/episodes/new?replace=${encodeURIComponent(target.id)}&number=${target.number}&title=${encodeURIComponent(target.title)}`,
    );
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Private shelf</p>
        <h1>비공개 보관함</h1>
        <p>
          작품을 가로질러 검수 대기 중인 회차를 모아 보여줍니다. 준비되면
          공개로 전환하세요.
        </p>
      </header>
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
        onRetry={retry}
        renameBusy={renameBusy}
        renameTarget={renameTarget}
      />
    </>
  );
}
