import { createHash } from "node:crypto";
import type { EpisodeLikeResponse } from "../contracts/episode-like";
import type { EpisodeLikeRepository } from "../repositories/episode-like-repository";

export class EpisodeLikeServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EpisodeLikeServiceError";
  }
}

export interface EpisodeLikeUseCases {
  setLiked(
    episodeId: string,
    viewerToken: string,
    liked: boolean,
  ): Promise<EpisodeLikeResponse>;
}

export class EpisodeLikeService implements EpisodeLikeUseCases {
  constructor(private readonly repository: EpisodeLikeRepository) {}

  async setLiked(
    episodeId: string,
    viewerToken: string,
    liked: boolean,
  ): Promise<EpisodeLikeResponse> {
    const viewerHash = createHash("sha256").update(viewerToken).digest("hex");
    const state = await this.repository.setLiked(episodeId, viewerHash, liked);
    if (!state) {
      throw new EpisodeLikeServiceError(
        "EPISODE_NOT_FOUND",
        "좋아요를 남길 수 있는 공개 회차를 찾지 못했습니다.",
        404,
      );
    }
    return { episodeId, ...state };
  }
}
