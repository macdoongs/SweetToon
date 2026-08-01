import { Router } from "express";
import {
  EpisodeLikeRequestSchema,
  EpisodeLikeResponseSchema,
} from "../contracts/episode-like";
import { IdParamSchema } from "../contracts/reader";
import type { EpisodeLikeUseCases } from "../services/episode-like-service";

export function createEpisodeLikeRouter(service: EpisodeLikeUseCases): Router {
  const router = Router();

  router.put("/episodes/:id/like", async (req, res) => {
    const episodeId = IdParamSchema.safeParse(req.params.id);
    const input = EpisodeLikeRequestSchema.safeParse(req.body);
    if (!episodeId.success || !input.success) {
      res.status(400).json({
        code: "INVALID_EPISODE_LIKE",
        message: "회차 좋아요 요청이 올바르지 않습니다.",
      });
      return;
    }
    res.json(
      EpisodeLikeResponseSchema.parse(
        await service.setLiked(
          episodeId.data,
          input.data.viewerToken,
          input.data.liked,
        ),
      ),
    );
  });

  return router;
}
