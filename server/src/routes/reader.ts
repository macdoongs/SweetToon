import { Router } from "express";
import {
  EpisodeReaderSchema,
  IdParamSchema,
  SeriesDetailSchema,
  SeriesListQuerySchema,
  SeriesListResponseSchema,
  SlugParamSchema,
} from "../contracts/reader";
import type { ReaderRepository } from "../repositories/reader-repository";
import {
  DiscoveryLimitQuerySchema,
  RecentEpisodesResponseSchema,
  SitemapDiscoveryResponseSchema,
} from "../contracts/discovery";
import {
  ShortsPreviewQuerySchema,
  ShortsPreviewResponseSchema,
} from "../contracts/shorts";

export function createReaderRouter(repository: ReaderRepository): Router {
  const router = Router();

  router.get("/series", async (req, res) => {
    const query = SeriesListQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        code: "INVALID_SERIES_FILTER",
        message: "작품 필터가 올바르지 않습니다.",
      });
      return;
    }

    const result = SeriesListResponseSchema.parse(
      await repository.listSeries(query.data),
    );
    res.json(result);
  });

  router.get("/series/:slug", async (req, res) => {
    const parsedSlug = SlugParamSchema.safeParse(req.params.slug);
    if (!parsedSlug.success) {
      res.status(400).json({
        code: "INVALID_SERIES_SLUG",
        message: "작품 주소가 올바르지 않습니다.",
      });
      return;
    }

    const result = await repository.findSeriesBySlug(parsedSlug.data);
    if (!result) {
      res.status(404).json({
        code: "SERIES_NOT_FOUND",
        message: "요청한 작품을 찾을 수 없습니다.",
      });
      return;
    }

    res.json(SeriesDetailSchema.parse(result));
  });

  router.get("/discovery/sitemap", async (_req, res) => {
    res.json(
      SitemapDiscoveryResponseSchema.parse(
        await repository.listSitemapDiscovery(),
      ),
    );
  });

  router.get("/discovery/recent-episodes", async (req, res) => {
    const query = DiscoveryLimitQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        code: "INVALID_DISCOVERY_LIMIT",
        message: "최근 회차 조회 개수가 올바르지 않습니다.",
      });
      return;
    }
    res.json(
      RecentEpisodesResponseSchema.parse({
        items: await repository.listRecentEpisodes(query.data.limit),
      }),
    );
  });

  router.get("/discovery/shorts", async (req, res) => {
    const query = ShortsPreviewQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        code: "INVALID_SHORTS_LIMIT",
        message: "쇼츠 미리보기 개수가 올바르지 않습니다.",
      });
      return;
    }
    const result = ShortsPreviewResponseSchema.parse({
      items: await repository.listShortsPreviews(
        query.data.limit,
        query.data.exclude,
      ),
    });
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(result);
  });

  router.get("/episodes/:id", async (req, res) => {
    const parsedId = IdParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      res.status(400).json({
        code: "INVALID_EPISODE_ID",
        message: "에피소드 주소가 올바르지 않습니다.",
      });
      return;
    }

    const authorization = req.header("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    const result = await repository.findEpisodeById(
      parsedId.data,
      accessToken,
    );
    if (!result) {
      res.status(404).json({
        code: "EPISODE_NOT_FOUND",
        message: "요청한 에피소드를 찾을 수 없습니다.",
      });
      return;
    }

    res.json(EpisodeReaderSchema.parse(result));
  });

  return router;
}
