"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getJson } from "@/lib/api";
import type { SeriesListResponse, SeriesSummary } from "@/lib/reader-types";
import {
  catalogHref,
  seriesFilterQuery,
  type CatalogFilters,
  type SeriesFilter,
  type Weekday,
} from "@/lib/series-filter";
import { ErrorState, LoadingCards } from "./reader-states";
import {
  getAllReadingProgress,
  type ReadingProgress,
} from "@/lib/reading-progress";
import type { LivePopularResponse } from "@/lib/realtime";
import { RecommendationShelves } from "./recommendation-shelves";
import { DiscoverLink } from "./discover-link";
import {
  buildCircularRailCopies,
  useCircularRail,
} from "./use-circular-rail";

const statusLabel = {
  ongoing: "연재 중",
  completed: "완결",
} as const;

const filterOptions: Array<{
  value: SeriesFilter;
  label: string;
  description: string;
}> = [
  { value: "all", label: "전체", description: "모든 작품" },
  { value: "ongoing", label: "연재 중", description: "새 화가 이어지는 작품" },
  {
    value: "collectible",
    label: "완결·소장 가능",
    description: "완결 시즌을 책으로 만들 수 있는 작품",
  },
];

const weekdayLabel: Record<Weekday, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

function getSeriesProgressFromStore(
  store: Record<string, ReadingProgress>,
  seriesSlug: string,
) {
  return Object.values(store)
    .filter((progress) => progress.seriesSlug === seriesSlug)
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )[0];
}

function formatLatestDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function SeriesCover({
  series,
  priority = false,
  sizes = "(max-width: 700px) calc(100vw - 28px), (max-width: 960px) calc((100vw - 70px) / 2), 360px",
}: {
  series: SeriesSummary;
  priority?: boolean;
  sizes?: string;
}) {
  return series.coverUrl ? (
    <Image
      alt={`${series.title} 표지`}
      className="series-cover"
      height={840}
      preload={priority}
      sizes={sizes}
      src={series.coverUrl}
      width={600}
    />
  ) : (
    <div className="series-cover series-cover--empty">{series.title}</div>
  );
}

function getLivePopularCardWidth(viewportWidth: number) {
  return viewportWidth <= 700
    ? Math.min(viewportWidth * 0.82, 340)
    : Math.min(Math.max(viewportWidth * 0.28, 280), 380);
}

function LivePopularRail({
  items,
}: {
  items: LivePopularResponse["items"];
}) {
  const { loopEnabled, railRef, scroll } =
    useCircularRail<HTMLUListElement>({
      cardWidth: getLivePopularCardWidth,
      itemCount: items.length,
    });
  const railCopies = buildCircularRailCopies(items);

  return (
    <section className="live-popular" aria-labelledby="live-popular-title">
      <div className="live-popular__inner">
        <div className="circular-rail-heading section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Live now</p>
            <h2 id="live-popular-title">지금 인기 있는 작품</h2>
          </div>
          <p>최근 1분 동안 독자들이 읽고 있는 작품이에요.</p>
          {loopEnabled ? (
            <div className="circular-rail-controls">
              <button
                aria-label="지금 인기 있는 작품 이전 작품 보기"
                onClick={() => scroll(-1)}
                type="button"
              >
                ←
              </button>
              <button
                aria-label="지금 인기 있는 작품 다음 작품 보기"
                onClick={() => scroll(1)}
                type="button"
              >
                →
              </button>
            </div>
          ) : null}
        </div>
        <ul
          aria-roledescription={
            loopEnabled ? "순환형 캐러셀" : "작품 목록"
          }
          className="circular-content-rail horizontal-scroll-surface live-popular__rail"
          id="live-popular-rail"
          ref={railRef}
        >
          {railCopies.map(
            (
              {
                copyIndex,
                duplicate,
                eager,
                item: { series, viewerCount },
              },
              index,
            ) => (
              <li
                aria-hidden={duplicate || undefined}
                className="live-popular-card"
                data-preloaded={eager || undefined}
                key={`${copyIndex}-${series.id}`}
              >
                <Link
                  href={`/series/${encodeURIComponent(series.slug)}`}
                  tabIndex={duplicate ? -1 : undefined}
                >
                  <span className="live-popular-card__rank">
                    {(index % items.length) + 1}
                  </span>
                  <div className="live-popular-card__cover">
                    <SeriesCover
                      priority={eager}
                      series={series}
                      sizes="(max-width: 700px) 72px, 84px"
                    />
                  </div>
                  <div>
                    <span>{series.genre}</span>
                    <strong>{series.title}</strong>
                    <small>
                      <i aria-hidden="true" />
                      지금 {viewerCount}명
                    </small>
                  </div>
                </Link>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

export function HomePage({
  activeFilters,
  initialData = null,
  recommendationSeries = [],
}: {
  activeFilters: CatalogFilters;
  initialData?: SeriesListResponse | null;
  recommendationSeries?: SeriesSummary[];
}) {
  const [data, setData] = useState<SeriesListResponse | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [readingProgress, setReadingProgress] = useState<
    Record<string, ReadingProgress>
  >({});
  const [livePopular, setLivePopular] = useState<LivePopularResponse | null>(
    null,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const retry = useCallback(() => {
    setError(null);
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const refresh = () => setReadingProgress(getAllReadingProgress());
    const frame = requestAnimationFrame(refresh);
    window.addEventListener("sweettoon:progress", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("sweettoon:progress", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await getJson<LivePopularResponse>(
          "/api/realtime/popular",
        );
        if (active) setLivePopular(response);
      } catch {
        if (active) setLivePopular(null);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (initialData && requestKey === 0) {
      return;
    }

    const controller = new AbortController();
    getJson<SeriesListResponse>(
      seriesFilterQuery(activeFilters),
      controller.signal,
    )
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "작품을 불러오지 못했습니다.",
          );
        }
      });
    return () => controller.abort();
  }, [activeFilters, initialData, requestKey]);

  const loadMore = useCallback(async () => {
    if (!data?.nextPage || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await getJson<SeriesListResponse>(
        seriesFilterQuery(activeFilters, data.nextPage),
      );
      setData((current) =>
        current
          ? {
              ...next,
              items: [...current.items, ...next.items],
              facets: current.facets,
            }
          : next,
      );
    } catch {
      setLoadMoreError("다음 작품을 불러오지 못했어요.");
    } finally {
      setLoadingMore(false);
    }
  }, [activeFilters, data, loadingMore]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !data?.nextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [data?.nextPage, loadMore]);

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  const featured = data?.items[0];

  return (
    <main>
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">웹툰의 마지막 장면, 그다음</p>
          <h1>
            좋아한 이야기를
            <br />
            <span>책장에 오래.</span>
          </h1>
          <p className="hero__description">
            SweetToon은 웹툰을 읽고, 완결된 시즌을 나만의 단행본으로
            소장하는 독자를 위한 공간입니다.
          </p>
          <div className="hero__actions">
            <DiscoverLink className="button button--primary">
              오늘의 작품 보기
            </DiscoverLink>
            <span className="hero__note">
              로그인 없이 바로 읽을 수 있어요
            </span>
          </div>
        </div>
        {featured ? (
          <Link
            className="featured-book"
            href={`/series/${encodeURIComponent(featured.slug)}`}
            aria-label={`${featured.title} 작품 보기`}
          >
            <div className="featured-book__halo" />
            <div className="featured-book__cover">
              <SeriesCover
                priority
                series={featured}
                sizes="(max-width: 700px) 240px, 300px"
              />
            </div>
            <div className="featured-book__caption">
              <span>오늘의 이야기</span>
              <strong>{featured.title}</strong>
            </div>
          </Link>
        ) : (
          <div className="featured-book featured-book--loading">
            <div className="skeleton skeleton--hero" />
          </div>
        )}
      </header>

      {livePopular?.items.length ? (
        <LivePopularRail items={livePopular.items} />
      ) : null}

      <RecommendationShelves series={recommendationSeries} />

      <section className="discover-section" id="discover">
        <div className="discover-section__inner">
          <div className="section-heading">
            <div>
              <p className="eyebrow">지금 펼쳐볼 이야기</p>
              <h2>당신의 다음 웹툰</h2>
            </div>
            <p>
              완결작은 한 권으로 소장할 수 있고,
              <br className="desktop-only" /> 연재작은 새 화를 이어서 볼 수
              있어요.
            </p>
          </div>

          <nav className="discover-filters" aria-label="작품 상태 필터">
            {filterOptions.map((option) => (
              <Link
                aria-current={
                  option.value === activeFilters.filter ? "page" : undefined
                }
                className="discover-filter"
                href={catalogHref({
                  ...activeFilters,
                  filter: option.value,
                })}
                key={option.value}
                title={option.description}
              >
                {option.label}
              </Link>
            ))}
            {data ? (
              <span className="discover-filter__count">
                {data.total}개 작품
              </span>
            ) : null}
          </nav>

          {data ? (
            <div className="catalog-sectors">
              <nav aria-label="요일별 작품">
                <strong>요일</strong>
                <Link
                  aria-current={!activeFilters.weekday ? "page" : undefined}
                  href={catalogHref({ ...activeFilters, weekday: undefined })}
                >
                  전체
                </Link>
                {data.facets.weekdays.map((weekday) => (
                  <Link
                    aria-current={
                      activeFilters.weekday === weekday ? "page" : undefined
                    }
                    href={catalogHref({ ...activeFilters, weekday })}
                    key={weekday}
                  >
                    {weekdayLabel[weekday]}
                  </Link>
                ))}
              </nav>
              <nav aria-label="장르별 작품">
                <strong>장르</strong>
                <Link
                  aria-current={!activeFilters.genre ? "page" : undefined}
                  href={catalogHref({ ...activeFilters, genre: undefined })}
                >
                  전체
                </Link>
                {data.facets.genres.map((genre) => (
                  <Link
                    aria-current={
                      activeFilters.genre === genre ? "page" : undefined
                    }
                    href={catalogHref({ ...activeFilters, genre })}
                    key={genre}
                  >
                    {genre}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}

          {!data ? (
            <LoadingCards />
          ) : data.items.length === 0 ? (
            <div className="empty-library">
              <span>
                {activeFilters.filter === "ongoing"
                  ? "지금 연재 중인 작품이 없어요."
                  : activeFilters.filter === "collectible"
                    ? "아직 소장 가능한 완결 시즌이 없어요."
                    : "첫 작품을 준비하고 있어요."}
              </span>
              <p>다른 분류의 작품을 먼저 만나 보세요.</p>
              {activeFilters.filter !== "all" ||
              activeFilters.genre ||
              activeFilters.weekday ? (
                <DiscoverLink className="text-link">
                  전체 작품 보기 →
                </DiscoverLink>
              ) : null}
            </div>
          ) : (
            <div className="card-grid">
              {data.items.map((series) => (
                <article className="series-card" key={series.id}>
                  <Link
                    className="series-card__image"
                    href={`/series/${encodeURIComponent(series.slug)}`}
                  >
                    <SeriesCover series={series} />
                    <span
                      className={`status-badge status-badge--${series.status}`}
                    >
                      {statusLabel[series.status]}
                    </span>
                  </Link>
                  <div className="series-card__body">
                    <span className="series-card__genre">{series.genre}</span>
                    <h3>
                      <Link href={`/series/${encodeURIComponent(series.slug)}`}>
                        {series.title}
                      </Link>
                    </h3>
                    <p className="series-card__author">{series.author.name}</p>
                    {getSeriesProgressFromStore(
                      readingProgress,
                      series.slug,
                    ) ? (
                      <Link
                        className="series-card__continue"
                        href={`/read/${encodeURIComponent(getSeriesProgressFromStore(readingProgress, series.slug)?.episodeId ?? "")}`}
                      >
                        <span>
                          이어보기 ·{" "}
                          {
                            getSeriesProgressFromStore(
                              readingProgress,
                              series.slug,
                            )?.episodeNumber
                          }
                          화
                        </span>
                        <progress
                          max={100}
                          value={
                            getSeriesProgressFromStore(
                              readingProgress,
                              series.slug,
                            )?.percent ?? 0
                          }
                        />
                      </Link>
                    ) : null}
                    {series.latestEpisode ? (
                      <Link
                        className="series-card__latest"
                        href={`/read/${encodeURIComponent(series.latestEpisode.id)}`}
                        aria-label={`${series.title} 최신 ${series.latestEpisode.number}화 ${series.latestEpisode.title} 읽기`}
                      >
                        <span>최신 {series.latestEpisode.number}화</span>
                        <strong>{series.latestEpisode.title}</strong>
                        <time dateTime={series.latestEpisode.publishedAt}>
                          {formatLatestDate(series.latestEpisode.publishedAt)}
                        </time>
                      </Link>
                    ) : (
                      <div className="series-card__latest series-card__latest--empty">
                        첫 에피소드를 준비하고 있어요
                      </div>
                    )}
                    <div className="series-card__footer">
                      <span>총 {series.episodeCount}화</span>
                      {series.completedSeasonCount > 0 ? (
                        <span className="series-card__collectible">
                          소장 가능 {series.completedSeasonCount}시즌
                        </span>
                      ) : (
                        <span>새 화 연재 중</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {data?.items.length ? (
            <div className="catalog-load-more" ref={loadMoreRef}>
              {loadMoreError ? (
                <>
                  <p role="alert">{loadMoreError}</p>
                  <button className="button button--ghost" onClick={loadMore}>
                    다시 불러오기
                  </button>
                </>
              ) : data.nextPage ? (
                <span aria-live="polite">
                  {loadingMore ? "다음 작품을 펼치는 중…" : "아래로 더 둘러보세요"}
                </span>
              ) : (
                <span>모든 작품을 둘러봤어요.</span>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="print-promise">
        <div className="print-promise__inner">
          <div className="print-promise__copy">
            <p className="eyebrow">From scroll to shelf</p>
            <h2>스크롤로 만난 이야기를, 종이 위에서 다시.</h2>
            <p>
              완결 시즌의 에피소드를 순서대로 묶어 표지와 판형을 고르면
              나만의 소장본 주문으로 이어집니다.
            </p>
          </div>
          <div className="print-promise__steps" aria-label="소장본 이용 순서">
            <span>01 작품 감상</span>
            <span>02 완결 시즌 선택</span>
            <span>03 단행본 주문</span>
          </div>
        </div>
      </section>
    </main>
  );
}
