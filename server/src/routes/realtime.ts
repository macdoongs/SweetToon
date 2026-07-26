import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  LivePopularResponseSchema,
  PresenceHeartbeatSchema,
  PresenceResponseSchema,
} from "../contracts/realtime";
import { SlugParamSchema } from "../contracts/reader";
import type { ReaderRepository } from "../repositories/reader-repository";
import {
  PRESENCE_TTL_SECONDS,
  type RealtimeService,
} from "../realtime/realtime-service";

const POPULAR_LIMIT = 6;
const POPULAR_CACHE_MS = 5_000;

export function createRealtimeRouter(
  repository: ReaderRepository,
  realtime: RealtimeService,
): Router {
  const router = Router();
  let popularCache:
    | {
        expiresAt: number;
        response: ReturnType<typeof LivePopularResponseSchema.parse>;
      }
    | undefined;
  let popularLoad:
    | {
        version: number;
        promise: Promise<ReturnType<typeof LivePopularResponseSchema.parse>>;
      }
    | undefined;
  let popularVersion = 0;
  const presenceRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        code: "PRESENCE_RATE_LIMITED",
        message: "읽기 상태 갱신이 너무 잦아요. 잠시 뒤 다시 시도해 주세요.",
      });
    },
  });

  router.post(
    "/series/:slug/presence",
    presenceRateLimit,
    async (req, res) => {
      const slug = SlugParamSchema.safeParse(req.params.slug);
      const input = PresenceHeartbeatSchema.safeParse(req.body);
      if (!slug.success || !input.success) {
        res.status(400).json({
          code: "INVALID_READER_PRESENCE",
          message: "현재 읽기 상태를 갱신하지 못했습니다.",
        });
        return;
      }
      if (!(await repository.seriesExists(slug.data))) {
        res.status(404).json({
          code: "SERIES_NOT_FOUND",
          message: "요청한 작품을 찾을 수 없습니다.",
        });
        return;
      }
      const viewerCount = await realtime.heartbeatSeries(
        slug.data,
        input.data.sessionId,
      );
      if (viewerCount === 1) {
        popularVersion += 1;
        popularCache = undefined;
      }
      res.json(
        PresenceResponseSchema.parse({
          seriesSlug: slug.data,
          viewerCount,
          expiresInSeconds: PRESENCE_TTL_SECONDS,
        }),
      );
    },
  );

  const loadPopular = async () => {
    const seriesKeys = await repository.listRealtimeSeriesKeys();
    const counts = await realtime.getViewerCounts(
      seriesKeys.map((item) => item.slug),
    );
    const rankedSlugs = seriesKeys
      .map(({ slug, title }) => ({
        slug,
        title,
        viewerCount: counts[slug] ?? 0,
      }))
      .filter((item) => item.viewerCount > 0)
      .sort(
        (left, right) =>
          right.viewerCount - left.viewerCount ||
          left.title.localeCompare(right.title, "ko"),
      )
      .slice(0, POPULAR_LIMIT);
    const series = await repository.listRealtimeSeries(
      rankedSlugs.map((item) => item.slug),
    );
    const seriesBySlug = new Map(series.map((item) => [item.slug, item]));
    const items = rankedSlugs.flatMap(({ slug, viewerCount }) => {
      const item = seriesBySlug.get(slug);
      return item ? [{ series: item, viewerCount }] : [];
    });

    return LivePopularResponseSchema.parse({
      items,
      generatedAt: new Date().toISOString(),
    });
  };

  router.get("/realtime/popular", async (_req, res) => {
    const now = Date.now();
    if (!popularCache || popularCache.expiresAt <= now) {
      const version = popularVersion;
      if (!popularLoad || popularLoad.version !== version) {
        const promise = loadPopular()
          .then((response) => {
            if (version === popularVersion) {
              popularCache = {
                expiresAt: Date.now() + POPULAR_CACHE_MS,
                response,
              };
            }
            return response;
          })
          .finally(() => {
            if (popularLoad?.promise === promise) {
              popularLoad = undefined;
            }
          });
        popularLoad = { version, promise };
      }
      const response = await popularLoad.promise;
      res.json(response);
      return;
    }
    res.json(popularCache.response);
  });

  return router;
}
