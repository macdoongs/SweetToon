"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { ApiError, postJson } from "@/lib/api";
import type {
  BookSize,
  CoverType,
  CreateOrderRequest,
  OrderDetail,
  PrintQuoteRequest,
  PrintQuoteResponse,
} from "@/lib/order-types";
import type { SeriesDetail } from "@/lib/reader-types";

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

type Season = SeriesDetail["seasons"][number];

export function OrderFormPage({
  series,
  season,
}: {
  series: SeriesDetail;
  season: Season;
}) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const [bookSize, setBookSize] = useState<BookSize>("A5");
  const [coverType, setCoverType] = useState<CoverType>("softcover");
  const [quantity, setQuantity] = useState(1);
  const [ordererName, setOrdererName] = useState("");
  const [memo, setMemo] = useState("");
  const [quote, setQuote] = useState<PrintQuoteResponse | null>(null);
  const [busy, setBusy] = useState<"quote" | "order" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const specification: PrintQuoteRequest = {
    seasonId: season.id,
    bookSize,
    coverType,
    quantity,
  };

  function invalidateQuote() {
    setQuote(null);
    setError(null);
    requestKey.current = null;
  }

  async function requestQuote() {
    setBusy("quote");
    setError(null);
    try {
      const result = await postJson<
        PrintQuoteRequest,
        PrintQuoteResponse
      >("/api/print-quotes", specification);
      setQuote(result);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "견적을 계산하지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) {
      setError("먼저 현재 사양의 견적을 확인해 주세요.");
      return;
    }
    if (ordererName.trim().length < 2) {
      setError("주문자 이름을 두 글자 이상 입력해 주세요.");
      return;
    }

    requestKey.current ??= crypto.randomUUID();
    setBusy("order");
    setError(null);
    try {
      const created = await postJson<CreateOrderRequest, OrderDetail>(
        "/api/orders",
        {
          ...specification,
          requestKey: requestKey.current,
          ordererName: ordererName.trim(),
          memo: memo.trim() || null,
        },
      );
      router.push(`/orders/${encodeURIComponent(created.id)}`);
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.code === "PRINT_SUBMISSION_FAILED"
      ) {
        requestKey.current = null;
      }
      setError(
        reason instanceof ApiError
          ? reason.message
          : "주문을 접수하지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="order-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/series/${encodeURIComponent(series.slug)}`}>
          {series.title}
        </Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">소장본 주문</strong>
      </nav>

      <header className="page-header">
        <p className="eyebrow">Shelf edition</p>
        <h1>읽던 이야기를<br />한 권으로 소장하세요.</h1>
        <p>
          {series.title} · 시즌 {season.number}{" "}
          {season.title ? `「${season.title}」` : ""}
        </p>
      </header>

      <form className="order-layout" onSubmit={submitOrder}>
        <div className="order-form">
          <section className="form-card">
            <span className="form-card__step">01</span>
            <div>
              <h2>책 사양</h2>
              <p>책장과 읽는 취향에 맞는 판형과 표지를 골라 주세요.</p>
            </div>

            <fieldset>
              <legend>판형</legend>
              <div className="choice-grid">
                {(["A5", "B5"] as const).map((size) => (
                  <label className="choice-card" key={size}>
                    <input
                      checked={bookSize === size}
                      name="bookSize"
                      onChange={() => {
                        setBookSize(size);
                        invalidateQuote();
                      }}
                      type="radio"
                      value={size}
                    />
                    <strong>{size}</strong>
                    <span>
                      {size === "A5"
                        ? "가볍고 손에 잘 잡히는 크기"
                        : "컷을 더 크게 보는 넉넉한 크기"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>표지</legend>
              <div className="choice-grid">
                {(["softcover", "hardcover"] as const).map((cover) => (
                  <label className="choice-card" key={cover}>
                    <input
                      checked={coverType === cover}
                      name="coverType"
                      onChange={() => {
                        setCoverType(cover);
                        invalidateQuote();
                      }}
                      type="radio"
                      value={cover}
                    />
                    <strong>
                      {cover === "softcover" ? "소프트커버" : "하드커버"}
                    </strong>
                    <span>
                      {cover === "softcover"
                        ? "부드럽게 넘기는 기본 표지"
                        : "오래 간직하기 좋은 단단한 표지"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>수량</span>
              <input
                max={50}
                min={1}
                onChange={(event) => {
                  setQuantity(Number(event.target.value));
                  invalidateQuote();
                }}
                type="number"
                value={quantity}
              />
            </label>
          </section>

          <section className="form-card">
            <span className="form-card__step">02</span>
            <div>
              <h2>주문자 정보</h2>
              <p>
                공개 데모이므로 실명이나 개인정보 대신 닉네임만 입력해 주세요.
                결제·배송지 정보는 수집하지 않습니다.
              </p>
            </div>
            <label className="field">
              <span>주문자 닉네임</span>
              <input
                autoComplete="off"
                maxLength={30}
                minLength={2}
                onChange={(event) => setOrdererName(event.target.value)}
                placeholder="예: 달빛독자"
                required
                value={ordererName}
              />
            </label>
            <label className="field">
              <span>제작 메모 <small>선택</small></span>
              <textarea
                maxLength={200}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="개인정보 없이 제작 참고사항만 남겨 주세요."
                rows={4}
                value={memo}
              />
              <small>{memo.length}/200</small>
            </label>
          </section>
        </div>

        <aside className="order-summary">
          <p className="eyebrow">Order summary</p>
          <h2>{series.title}</h2>
          <p>
            시즌 {season.number} · {season.title ?? `시즌 ${season.number}`}
          </p>
          <dl>
            <div><dt>판형</dt><dd>{bookSize}</dd></div>
            <div>
              <dt>표지</dt>
              <dd>{coverType === "softcover" ? "소프트커버" : "하드커버"}</dd>
            </div>
            <div><dt>수량</dt><dd>{quantity}권</dd></div>
            {quote ? (
              <>
                <div><dt>인쇄 페이지</dt><dd>{quote.pageCount}쪽</dd></div>
                <div><dt>권당 예상가</dt><dd>{won.format(quote.unitPrice)}</dd></div>
              </>
            ) : null}
          </dl>

          {quote ? (
            <div className="quote-total" aria-live="polite">
              <span>예상 제작비</span>
              <strong>{won.format(quote.totalPrice)}</strong>
              <small>Mock 견적 · 제작 약 {quote.estimatedBusinessDays}영업일</small>
            </div>
          ) : (
            <button
              className="button button--light button--wide"
              disabled={busy !== null}
              onClick={requestQuote}
              type="button"
            >
              {busy === "quote" ? "견적 계산 중…" : "견적 확인하기"}
            </button>
          )}

          {error ? (
            <p className="form-error" role="alert">{error}</p>
          ) : null}

          {quote ? (
            <button
              className="button button--primary button--wide"
              disabled={busy !== null}
              type="submit"
            >
              {busy === "order" ? "주문 접수 중…" : "이 사양으로 주문하기"}
            </button>
          ) : null}
          <p className="order-summary__notice">
            실제 결제나 인쇄 API 호출 없이 Mock provider로 접수됩니다.
          </p>
        </aside>
      </form>
    </main>
  );
}
