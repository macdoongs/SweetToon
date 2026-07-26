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

export function createRealtimeRouter(
  repository: ReaderRepository,
  realtime: RealtimeService,
): Router {
  const router = Router();
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
      res.json(
        PresenceResponseSchema.parse({
          seriesSlug: slug.data,
          viewerCount,
          expiresInSeconds: PRESENCE_TTL_SECONDS,
        }),
      );
    },
  );

  router.get("/realtime/popular", async (_req, res) => {
    const series = await repository.listRealtimeSeries();
    const counts = await realtime.getViewerCounts(
      series.map((item) => item.slug),
    );
    const items = series
      .map((item) => ({
        series: item,
        viewerCount: counts[item.slug] ?? 0,
      }))
      .filter((item) => item.viewerCount > 0)
      .sort(
        (left, right) =>
          right.viewerCount - left.viewerCount ||
          left.series.title.localeCompare(right.series.title, "ko"),
      )
      .slice(0, POPULAR_LIMIT);

    res.json(
      LivePopularResponseSchema.parse({
        items,
        generatedAt: new Date().toISOString(),
      }),
    );
  });

  return router;
}
