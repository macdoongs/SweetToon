import type { CreateEpisodeRequest } from "../contracts/studio";
import type {
  StudioRepository,
  StudioSeason,
} from "../repositories/studio-repository";
import type {
  StudioStorage,
  UploadSession,
} from "../uploads/upload-session-storage";
import { StudioService } from "./studio-service";

const session: UploadSession = {
  id: "a62ba8b5-f8aa-4220-a849-55a49be66f5a",
  originalName: "episode.zip",
  createdAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-07-24T01:00:00.000Z",
  pages: [
    {
      id: "b74fb5ce-d837-40a6-ab85-e34f67f8668f",
      originalName: "1.png",
      storedName: "first.png",
      byteSize: 100,
    },
    {
      id: "76a6178c-65ca-4977-b4ef-ab2a0d88539d",
      originalName: "2.png",
      storedName: "second.png",
      byteSize: 100,
    },
  ],
};

const season: StudioSeason = {
  id: "season-1",
  number: 1,
  status: "ongoing",
  series: {
    id: "series-1",
    slug: "moonlight-laundry",
    title: "달빛 세탁소",
  },
};

const input: CreateEpisodeRequest = {
  sessionId: session.id,
  seasonId: season.id,
  number: 12,
  title: "새벽의 손님",
  pageIds: session.pages.map((page) => page.id),
};

function makeDependencies() {
  const repository: jest.Mocked<StudioRepository> = {
    findSeason: jest.fn().mockResolvedValue(season),
    createEpisode: jest.fn().mockResolvedValue({ id: "episode-12" }),
    deleteEpisode: jest.fn().mockResolvedValue(undefined),
    updateAccessPolicy: jest.fn().mockResolvedValue({
      seriesId: season.series.id,
      freeVolumeCount: 1,
      previewEpisodeCount: 2,
    }),
  };
  const storage: jest.Mocked<StudioStorage> = {
    createSession: jest.fn().mockResolvedValue(session),
    getSession: jest.fn().mockResolvedValue(session),
    getPreviewPath: jest.fn().mockResolvedValue("C:\\preview.png"),
    publish: jest.fn().mockResolvedValue({
      directory: "C:\\published",
      imageUrls: ["/api/images/1.png", "/api/images/2.png"],
    }),
    removeSession: jest.fn().mockResolvedValue(undefined),
    removePublished: jest.fn().mockResolvedValue(undefined),
    cleanupExpired: jest.fn().mockResolvedValue(undefined),
  };
  return {
    repository,
    storage,
    service: new StudioService(repository, storage),
  };
}

describe("StudioService", () => {
  it("publishes files in the confirmed order and creates one episode", async () => {
    const { service, repository, storage } = makeDependencies();
    const reversed = {
      ...input,
      pageIds: [...input.pageIds].reverse(),
    };

    const created = await service.createEpisode(reversed);

    expect(storage.publish).toHaveBeenCalledWith(
      session,
      expect.arrayContaining(["moonlight-laundry", "s1"]),
      reversed.pageIds,
    );
    expect(repository.createEpisode).toHaveBeenCalledWith({
      seasonId: "season-1",
      number: 12,
      title: "새벽의 손님",
      imageUrls: ["/api/images/1.png", "/api/images/2.png"],
    });
    expect(storage.removeSession).toHaveBeenCalledWith(session.id);
    expect(created.readerUrl).toBe("/read/episode-12");
  });

  it("rejects missing or duplicated preview pages", async () => {
    const { service, repository, storage } = makeDependencies();

    await expect(
      service.createEpisode({
        ...input,
        pageIds: [session.pages[0].id, session.pages[0].id],
      }),
    ).rejects.toMatchObject({ code: "PAGE_ORDER_INVALID", status: 400 });
    expect(storage.publish).not.toHaveBeenCalled();
    expect(repository.createEpisode).not.toHaveBeenCalled();
  });

  it("rejects uploads to completed seasons", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.findSeason.mockResolvedValue({
      ...season,
      status: "completed",
    });

    await expect(service.createEpisode(input)).rejects.toMatchObject({
      code: "SEASON_ALREADY_COMPLETED",
      status: 409,
    });
    expect(storage.publish).not.toHaveBeenCalled();
  });

  it("removes published files if the database transaction fails", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.createEpisode.mockRejectedValue(new Error("database down"));

    await expect(service.createEpisode(input)).rejects.toThrow("database down");
    expect(storage.removePublished).toHaveBeenCalledWith("C:\\published");
    expect(storage.removeSession).not.toHaveBeenCalled();
  });
});
