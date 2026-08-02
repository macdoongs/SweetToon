"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { deleteRequest, postFormData } from "@/lib/api";
import { studioHeaders } from "@/lib/studio-headers";
import type { UploadPreview } from "@/lib/studio-types";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ZIP/CBZ 업로드와 페이지 순서 확인을 담당하는 공용 워크스페이스.
// 발행·교체·패키징 등 제출 동작은 renderSubmitBar로 부모가 소유한다.
export function StudioUploadWorkspace({
  busy,
  hidden = false,
  notice,
  onPreviewChange,
  onUploadError,
  preview,
  renderSubmitBar,
}: {
  busy: boolean;
  hidden?: boolean;
  notice?: ReactNode;
  onPreviewChange: (preview: UploadPreview | null) => void;
  onUploadError: (message: string | null) => void;
  preview: UploadPreview | null;
  renderSubmitBar: (preview: UploadPreview) => ReactNode;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadArchive(file: File | undefined) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "zip" && extension !== "cbz") {
      onUploadError("확장자가 .zip 또는 .cbz인 파일을 선택해 주세요.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      onUploadError("ZIP 파일은 25MB 이하로 올려 주세요.");
      return;
    }

    if (preview) {
      await deleteRequest(
        `/api/studio/uploads/${encodeURIComponent(preview.sessionId)}`,
        studioHeaders(),
      ).catch(() => undefined);
    }
    setUploading(true);
    onUploadError(null);
    const formData = new FormData();
    formData.append("archive", file);
    try {
      const result = await postFormData<UploadPreview>(
        "/api/studio/uploads",
        formData,
        studioHeaders(),
      );
      onPreviewChange(result);
    } catch (reason) {
      onPreviewChange(null);
      onUploadError(
        reason instanceof Error
          ? reason.message
          : "원고를 분석하지 못했습니다.",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function movePage(index: number, direction: -1 | 1) {
    if (!preview) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= preview.pages.length) return;
    const pages = [...preview.pages];
    [pages[index], pages[nextIndex]] = [pages[nextIndex], pages[index]];
    onPreviewChange({ ...preview, pages });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadArchive(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadArchive(event.dataTransfer.files[0]);
  }

  const disabled = busy || uploading;

  return (
    <section className="studio-workspace">
      {notice}

      {!hidden && !preview ? (
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
            {uploading
              ? "페이지 순서를 확인하고 있어요…"
              : "원고 묶음을 여기에 놓으세요."}
          </h2>
          <p>파일명은 1, 2, 10처럼 자연스럽게 정렬됩니다.</p>
          <button
            className="button button--primary"
            disabled={disabled}
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
              disabled={disabled}
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
          <div className="studio-publish-bar">{renderSubmitBar(preview)}</div>
        </>
      ) : null}
    </section>
  );
}
