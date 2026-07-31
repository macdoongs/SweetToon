"use client";

import { useRef, useState } from "react";
import { ApiError, isUncertainRequestError, postJson } from "@/lib/api";
import { studioHeaders } from "@/lib/studio-headers";
import type {
  CreatePackagingRequest,
  PackagingBookSize,
  PackagingCoverType,
  PackagingRequest,
  UploadPreview,
} from "@/lib/studio-types";
import { useStudioCollections } from "@/lib/use-studio-collections";
import { StudioPackagingHistory } from "./studio-packaging-history";
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

export function StudioPackagingPage() {
  const {
    packagingRequests,
    setPackagingRequests,
    packagingState,
    retry,
  } = useStudioCollections();
  const [applicantName, setApplicantName] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookSize, setBookSize] = useState<PackagingBookSize>("A5");
  const [coverType, setCoverType] = useState<PackagingCoverType>("softcover");
  const [quantity, setQuantity] = useState(1);
  const [packagingMemo, setPackagingMemo] = useState("");
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packagingResult, setPackagingResult] =
    useState<PackagingRequest | null>(null);
  const packagingAttempt = useRef<IdempotentAttempt | null>(null);

  async function submitPackagingRequest(currentPreview: UploadPreview) {
    if (applicantName.trim().length < 2) {
      setError("신청자 이름을 두 글자 이상 입력해 주세요.");
      return;
    }
    if (bookTitle.trim().length === 0) {
      setError("만들 책의 제목을 입력해 주세요.");
      return;
    }
    const payload: Omit<CreatePackagingRequest, "requestKey"> = {
      sessionId: currentPreview.sessionId,
      pageIds: currentPreview.pages.map((page) => page.id),
      applicantName: applicantName.trim(),
      bookTitle: bookTitle.trim(),
      bookSize,
      coverType,
      quantity,
      memo: packagingMemo.trim() || null,
    };
    const requestKey = idempotencyKeyFor(packagingAttempt, payload);
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<CreatePackagingRequest, PackagingRequest>(
        "/api/studio/packaging-requests",
        { requestKey, ...payload },
        undefined,
        studioHeaders(),
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
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Book packaging</p>
        <h1>책 패키징 신청</h1>
        <p>
          플랫폼 밖 원고도 ZIP/CBZ로 올려 실물 책 패키징 서비스를 신청할 수
          있어요. 실제 인쇄 없이 접수와 상태만 관리하는 데모 흐름입니다.
        </p>
      </header>

      {error ? (
        <p className="studio-error" role="alert">{error}</p>
      ) : null}

      {!packagingResult ? (
        <section
          className="studio-packaging-form"
          aria-label="패키징 신청 정보"
        >
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
            <label className="field">
              <span>수량</span>
              <input
                max={500}
                min={1}
                onChange={(event) =>
                  setQuantity(
                    Math.max(1, Math.trunc(event.target.valueAsNumber || 1)),
                  )
                }
                type="number"
                value={quantity}
              />
            </label>
          </div>
          <label className="field">
            <span>제작 메모 (선택)</span>
            <textarea
              maxLength={500}
              onChange={(event) => setPackagingMemo(event.target.value)}
              rows={2}
              value={packagingMemo}
            />
          </label>
        </section>
      ) : null}

      <StudioUploadWorkspace
        busy={busy}
        hidden={Boolean(packagingResult)}
        onPreviewChange={setPreview}
        onUploadError={setError}
        preview={preview}
        renderSubmitBar={(currentPreview) => (
          <>
            <div>
              <strong>
                {bookSize} ·{" "}
                {coverType === "hardcover" ? "하드커버" : "소프트커버"} ·{" "}
                {quantity}부
              </strong>
              <span>
                내지 {currentPreview.pages.length}쪽으로 패키징을 신청합니다.
              </span>
            </div>
            <button
              className="button button--primary"
              disabled={busy}
              onClick={() => void submitPackagingRequest(currentPreview)}
              type="button"
            >
              {busy ? "접수 중…" : "패키징 신청"}
            </button>
          </>
        )}
      />

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
            · {packagingResult.quantity}부
          </p>
          <div>
            <button
              className="button button--ghost"
              onClick={() => setPackagingResult(null)}
              type="button"
            >
              새 신청 접수
            </button>
          </div>
        </div>
      ) : null}

      <StudioPackagingHistory
        onRetry={retry}
        requests={packagingRequests}
        state={packagingState}
      />
    </>
  );
}
