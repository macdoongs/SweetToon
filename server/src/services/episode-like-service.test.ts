import { createHash } from "node:crypto";
import type { EpisodeLikeRepository } from "../repositories/episode-like-repository";
import { EpisodeLikeService } from "./episode-like-service";

const viewerToken = "e4a40518-b468-4a0a-b51d-309cd07e630c";

function repository(): jest.Mocked<EpisodeLikeRepository> {
  return { setLiked: jest.fn() };
}

describe("EpisodeLikeService", () => {
  it("stores only a deterministic hash and returns the aggregate", async () => {
    const likes = repository();
    likes.setLiked.mockResolvedValue({ liked: true, likeCount: 12 });
    const service = new EpisodeLikeService(likes);

    await expect(
      service.setLiked("episode-1", viewerToken, true),
    ).resolves.toEqual({
      episodeId: "episode-1",
      liked: true,
      likeCount: 12,
    });
    expect(likes.setLiked).toHaveBeenCalledWith(
      "episode-1",
      createHash("sha256").update(viewerToken).digest("hex"),
      true,
    );
    expect(likes.setLiked).not.toHaveBeenCalledWith(
      "episode-1",
      viewerToken,
      true,
    );
  });

  it("does not expose private or missing episodes as likeable", async () => {
    const likes = repository();
    likes.setLiked.mockResolvedValue(null);
    const service = new EpisodeLikeService(likes);

    await expect(
      service.setLiked("private-episode", viewerToken, true),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "EPISODE_NOT_FOUND",
        status: 404,
      }),
    );
  });
});
