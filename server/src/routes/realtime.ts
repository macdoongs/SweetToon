import { Router } from "express";
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

  router.post("/series/:slug/presence", async (req, res) => {
    const slug = SlugParamSchema.safeParse(req.params.slug);
    const input = PresenceHeartbeatSchema.safeParse(req.body);
    if (!slug.success || !input.success) {
      res.status(400).json({
        code: "INVALID_READER_PRESENCE",
        message: "현재 읽기 상태를 갱신하지 못했습니다.",
      });
      return;
    }
    if (!(await repository.findSeriesBySlug(slug.data))) {
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
  });

  router.get("/realtime/popular", async (_req, res) => {
    const firstPage = await repository.listSeries({
      filter: "all",
      page: 1,
      pageSize: 24,
    });
    const secondPage = firstPage.nextPage
      ? await repository.listSeries({
          filter: "all",
          page: firstPage.nextPage,
          pageSize: 24,
        })
      : null;
    const series = [...firstPage.items, ...(secondPage?.items ?? [])];
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
