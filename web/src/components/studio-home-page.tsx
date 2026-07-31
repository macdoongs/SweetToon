"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, isUncertainRequestError, postJson } from "@/lib/api";
import { studioHeaders } from "@/lib/studio-headers";
import type {
  CreateSeriesRequest,
  CreateSeriesResponse,
  StudioSeriesSummary,
} from "@/lib/studio-types";

type NewSeriesDraft = Omit<CreateSeriesRequest, "requestKey">;
type IdempotentAttempt = { fingerprint: string; requestKey: string };

const EMPTY_NEW_SERIES: NewSeriesDraft = {
  slug: "",
  title: "",
  synopsis: "",
  genre: "",
  weekday: "mon",
  authorName: "",
};

const WEEKDAY_LABEL: Record<CreateSeriesRequest["weekday"], string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

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

export function StudioHomePage({
  seriesList,
}: {
  seriesList: StudioSeriesSummary[];
}) {
  const router = useRouter();
  const [newSeries, setNewSeries] =
    useState<NewSeriesDraft>(EMPTY_NEW_SERIES);
  const [newSeriesBusy, setNewSeriesBusy] = useState(false);
  const [newSeriesMessage, setNewSeriesMessage] = useState<string | null>(
    null,
  );
  const seriesAttempt = useRef<IdempotentAttempt | null>(null);

  async function createNewSeries() {
    const payload: NewSeriesDraft = {
      slug: newSeries.slug.trim(),
      title: newSeries.title.trim(),
      synopsis: newSeries.synopsis.trim(),
      genre: newSeries.genre.trim(),
      weekday: newSeries.weekday,
      authorName: newSeries.authorName.trim(),
    };
    if (
      !payload.slug ||
      !payload.title ||
      !payload.synopsis ||
      !payload.genre ||
      !payload.authorName
    ) {
      setNewSeriesMessage("모든 항목을 입력해 주세요.");
      return;
    }
    const requestKey = idempotencyKeyFor(seriesAttempt, payload);
    setNewSeriesBusy(true);
    setNewSeriesMessage(null);
    try {
      const created = await postJson<
        CreateSeriesRequest,
        CreateSeriesResponse
      >(
        "/api/studio/series",
        { requestKey, ...payload },
        undefined,
        studioHeaders(),
      );
      seriesAttempt.current = null;
      setNewSeries(EMPTY_NEW_SERIES);
      // 새 작품 관리 화면에서 바로 원고를 올릴 수 있게 이동한다.
      router.push(`/studio/series/${encodeURIComponent(created.slug)}`);
    } catch (reason) {
      if (!isUncertainRequestError(reason)) seriesAttempt.current = null;
      setNewSeriesMessage(
        reason instanceof ApiError
          ? reason.message
          : "작품을 만들지 못했습니다.",
      );
    } finally {
      setNewSeriesBusy(false);
    }
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Creator studio</p>
        <h1>작가 스튜디오</h1>
        <p>
          작품을 골라 회차를 올리고, 시즌과 공개 범위를 관리하세요. 데모용
          공용 스튜디오라 모든 방문자가 같은 목록을 봅니다.
        </p>
      </header>

      <section className="studio-home-grid" aria-label="내 작품 목록">
        {seriesList.map((series) => {
          const ongoing = series.seasons.filter(
            (season) => season.status === "ongoing",
          ).length;
          const episodeCount = series.seasons.reduce(
            (sum, season) => sum + season.episodeCount,
            0,
          );
          return (
            <Link
              className="studio-home-card"
              href={`/studio/series/${encodeURIComponent(series.slug)}`}
              key={series.id}
            >
              <span className="studio-home-card__cover">
                {series.coverUrl ? (
                  <Image
                    alt=""
                    height={168}
                    sizes="86px"
                    src={series.coverUrl}
                    width={120}
                  />
                ) : (
                  <i aria-hidden="true">표지 없음</i>
                )}
              </span>
              <span className="studio-home-card__body">
                <strong>{series.title}</strong>
                <span>
                  시즌 {series.seasons.length}개 ·{" "}
                  {ongoing > 0 ? "연재 중" : "완결"} · 공개 {episodeCount}화
                </span>
                <em>관리하기 →</em>
              </span>
            </Link>
          );
        })}
      </section>

      <section
        className="studio-drafts studio-home-new-series"
        aria-label="새 작품 만들기"
      >
        <header>
          <div>
            <p className="eyebrow">New series</p>
            <h2>새 작품 만들기</h2>
          </div>
          <p>시즌 1이 함께 만들어져 바로 연재를 시작할 수 있어요.</p>
        </header>
        <div className="studio-new-series-form">
          <label className="field">
            <span>주소(slug)</span>
            <input
              maxLength={80}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  slug: event.target.value.toLowerCase(),
                }))
              }
              placeholder="night-market"
              value={newSeries.slug}
            />
          </label>
          <label className="field">
            <span>새 작품 제목</span>
            <input
              maxLength={80}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              value={newSeries.title}
            />
          </label>
          <label className="field">
            <span>줄거리</span>
            <textarea
              maxLength={1000}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  synopsis: event.target.value,
                }))
              }
              rows={3}
              value={newSeries.synopsis}
            />
          </label>
          <div className="studio-number-title">
            <label className="field">
              <span>장르</span>
              <input
                maxLength={40}
                onChange={(event) =>
                  setNewSeries((current) => ({
                    ...current,
                    genre: event.target.value,
                  }))
                }
                value={newSeries.genre}
              />
            </label>
            <label className="field">
              <span>연재 요일</span>
              <select
                onChange={(event) =>
                  setNewSeries((current) => ({
                    ...current,
                    weekday: event.target
                      .value as CreateSeriesRequest["weekday"],
                  }))
                }
                value={newSeries.weekday}
              >
                {(
                  Object.keys(WEEKDAY_LABEL) as Array<
                    CreateSeriesRequest["weekday"]
                  >
                ).map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {WEEKDAY_LABEL[weekday]}요일
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>작가 이름</span>
            <input
              maxLength={40}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  authorName: event.target.value,
                }))
              }
              value={newSeries.authorName}
            />
          </label>
          <button
            className="button button--primary button--wide"
            disabled={newSeriesBusy}
            onClick={() => void createNewSeries()}
            type="button"
          >
            {newSeriesBusy ? "만드는 중…" : "작품 만들기"}
          </button>
          <p aria-live="polite">
            {newSeriesMessage ??
              "만들어진 작품은 목록에서 바로 관리할 수 있어요."}
          </p>
        </div>
      </section>
    </>
  );
}
