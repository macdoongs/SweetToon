import request from "supertest";
import { createApp } from "../app";
import type { ReaderRepository } from "../repositories/reader-repository";
import {
  EpisodeLikeServiceError,
  type EpisodeLikeUseCases,
} from "../services/episode-like-service";

const viewerToken = "e4a40518-b468-4a0a-b51d-309cd07e630c";

function appWith(service: jest.Mocked<EpisodeLikeUseCases>) {
  return createApp({
    readerRepository: {} as ReaderRepository,
    episodeLikeService: service,
  });
}

describe("episode like route", () => {
  it("sets an episode like idempotently", async () => {
    const service: jest.Mocked<EpisodeLikeUseCases> = {
      setLiked: jest.fn().mockResolvedValue({
        episodeId: "episode-1",
        liked: true,
        likeCount: 7,
      }),
    };

    const response = await request(appWith(service))
      .put("/api/episodes/episode-1/like")
      .send({ viewerToken, liked: true })
      .expect(200);

    expect(response.body).toEqual({
      episodeId: "episode-1",
      liked: true,
      likeCount: 7,
    });
    expect(service.setLiked).toHaveBeenCalledWith(
      "episode-1",
      viewerToken,
      true,
    );
  });

  it("rejects malformed anonymous viewer tokens", async () => {
    const service: jest.Mocked<EpisodeLikeUseCases> = {
      setLiked: jest.fn(),
    };

    const response = await request(appWith(service))
      .put("/api/episodes/episode-1/like")
      .send({ viewerToken: "raw-browser-id", liked: true })
      .expect(400);

    expect(response.body.code).toBe("INVALID_EPISODE_LIKE");
    expect(service.setLiked).not.toHaveBeenCalled();
  });

  it("returns a stable not-found error for non-public episodes", async () => {
    const service: jest.Mocked<EpisodeLikeUseCases> = {
      setLiked: jest.fn().mockRejectedValue(
        new EpisodeLikeServiceError(
          "EPISODE_NOT_FOUND",
          "좋아요를 남길 수 있는 공개 회차를 찾지 못했습니다.",
          404,
        ),
      ),
    };

    const response = await request(appWith(service))
      .put("/api/episodes/private/like")
      .send({ viewerToken, liked: true })
      .expect(404);

    expect(response.body.code).toBe("EPISODE_NOT_FOUND");
  });
});
