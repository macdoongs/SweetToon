import type { CreateEpisodeRequest } from "../contracts/studio";
import sharp from "sharp";
import {
  StudioRepositoryError,
  type StudioRepository,
  type StudioSeason,
} from "../repositories/studio-repository";
import type {
  StudioStorage,
  UploadSession,
} from "../uploads/upload-session-storage";
import { StudioService } from "./studio-service";
import {
  MalwareDetectedError,
  type MalwareScanner,
} from "../security/malware-scanner";

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
  visibility: "public",
};

function makeDependencies(malwareScanner?: MalwareScanner) {
  const repository: jest.Mocked<StudioRepository> = {
    findSeason: jest.fn().mockResolvedValue(season),
    createEpisode: jest.fn().mockResolvedValue({ id: "episode-12" }),
    deleteEpisode: jest.fn().mockResolvedValue(undefined),
    updateAccessPolicy: jest.fn().mockResolvedValue({
      seriesId: season.series.id,
      freeVolumeCount: 1,
      previewEpisodeCount: 2,
    }),
    setEpisodeVisibility: jest.fn().mockResolvedValue(null),
    updateEpisode: jest.fn().mockResolvedValue(null),
    countCandyEntitlements: jest.fn().mockResolvedValue(0),
    updateSeriesCover: jest.fn().mockResolvedValue({
      seriesId: "series-1",
      coverUrl: "/api/images/studio/covers/series-1-cover.webp",
    }),
    updateSeriesInfo: jest.fn().mockResolvedValue(null),
    createSeries: jest.fn().mockResolvedValue({
      seriesId: "series-2",
      slug: "night-market",
      title: "야시장",
      seasonId: "season-2",
    }),
    updateSeasonStatus: jest.fn().mockResolvedValue({
      seasonId: "season-1",
      seriesId: "series-1",
      number: 1,
      status: "completed",
    }),
    createSeason: jest.fn().mockResolvedValue({
      seasonId: "season-2",
      seriesId: "series-1",
      number: 2,
      status: "ongoing",
    }),
    findPackagingRequest: jest.fn().mockResolvedValue({
      id: "packaging-1",
      applicantName: "박야근",
      bookTitle: "야근의 기록",
      bookSize: "A5",
      coverType: "softcover",
      quantity: 30,
      memo: null,
      pageCount: 2,
      status: "received",
      createdAt: "2026-07-27T00:00:00.000Z",
    }),
    updatePackagingStatus: jest.fn().mockImplementation(
      async (_id, status) => ({
        id: "packaging-1",
        applicantName: "박야근",
        bookTitle: "야근의 기록",
        bookSize: "A5",
        coverType: "softcover",
        quantity: 30,
        memo: null,
        pageCount: 2,
        status,
        createdAt: "2026-07-27T00:00:00.000Z",
      }),
    ),
    findEpisode: jest.fn().mockResolvedValue({
      id: "episode-12",
      number: 12,
      title: "새벽의 손님",
      visibility: "public",
      manuscriptDir: "C:\\old-manuscript",
      season: {
        id: "season-1",
        number: 1,
        series: { slug: "moonlight-laundry", title: "달빛 세탁소" },
      },
    }),
    replaceEpisodePages: jest.fn().mockResolvedValue(undefined),
    listDraftEpisodes: jest.fn().mockResolvedValue([]),
    createPackagingRequest: jest.fn().mockImplementation(
      async (request) => ({
        id: "packaging-1",
        applicantName: request.applicantName,
        bookTitle: request.bookTitle,
        bookSize: request.bookSize,
        coverType: request.coverType,
        quantity: request.quantity,
        memo: request.memo,
        pageCount: request.pageCount,
        status: "received",
        createdAt: "2026-07-27T00:00:00.000Z",
      }),
    ),
    listPackagingRequests: jest.fn().mockResolvedValue([]),
  };
  const storage: jest.Mocked<StudioStorage> = {
    createSession: jest.fn().mockResolvedValue(session),
    getSession: jest.fn().mockResolvedValue(session),
    getPreviewPath: jest.fn().mockResolvedValue("C:\\preview.png"),
    publish: jest.fn().mockResolvedValue({
      directory: "C:\\published",
      imageUrls: ["/api/images/1.png", "/api/images/2.png"],
    }),
    publishCover: jest.fn().mockResolvedValue({
      url: "/api/images/studio/covers/series-1-cover.webp",
      location: "C:\\covers\\series-1-cover.webp",
    }),
    removeSession: jest.fn().mockResolvedValue(undefined),
    removePublished: jest.fn().mockResolvedValue(undefined),
    cleanupExpired: jest.fn().mockResolvedValue(undefined),
  };
  return {
    repository,
    storage,
    service: new StudioService(repository, storage, malwareScanner),
  };
}

describe("StudioService", () => {
  it("rejects a malware finding before archive analysis or staging", async () => {
    const malwareScanner: MalwareScanner = {
      name: "test",
      scan: jest
        .fn()
        .mockRejectedValue(new MalwareDetectedError("test-signature")),
    };
    const { service, storage } = makeDependencies(malwareScanner);

    await expect(
      service.previewArchive("episode.zip", Buffer.from("PK archive")),
    ).rejects.toMatchObject({
      code: "ARCHIVE_MALWARE_DETECTED",
      status: 422,
    });
    expect(storage.createSession).not.toHaveBeenCalled();
  });

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
      visibility: "public",
      manuscriptDir: "C:\\published",
    });
    expect(storage.removeSession).toHaveBeenCalledWith(session.id);
    expect(created.readerUrl).toBe("/read/episode-12");
    expect(created.visibility).toBe("public");
  });

  it("keeps a private upload out of the public flow but readable by link", async () => {
    const { service, repository } = makeDependencies();

    const created = await service.createEpisode({
      ...input,
      visibility: "private",
    });

    expect(repository.createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "private" }),
    );
    expect(created.visibility).toBe("private");
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

  it("accepts a packaging request and consumes the upload session", async () => {
    const { service, repository, storage } = makeDependencies();

    const created = await service.createPackagingRequest({
      sessionId: session.id,
      pageIds: session.pages.map((page) => page.id),
      applicantName: "박야근",
      bookTitle: "야근의 기록",
      bookSize: "A5",
      coverType: "softcover",
      quantity: 30,
      memo: "독립출판 마켓용",
    });

    expect(storage.publish).toHaveBeenCalledWith(
      session,
      ["packaging", expect.any(String)],
      session.pages.map((page) => page.id),
    );
    expect(repository.createPackagingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantName: "박야근",
        bookTitle: "야근의 기록",
        pageCount: 2,
        manuscriptDir: "C:\\published",
      }),
    );
    expect(storage.removeSession).toHaveBeenCalledWith(session.id);
    expect(created.status).toBe("received");
  });

  it("removes packaging files if the request record fails", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.createPackagingRequest.mockRejectedValue(
      new Error("database down"),
    );

    await expect(
      service.createPackagingRequest({
        sessionId: session.id,
        pageIds: session.pages.map((page) => page.id),
        applicantName: "박야근",
        bookTitle: "야근의 기록",
        bookSize: "B5",
        coverType: "hardcover",
        quantity: 1,
        memo: null,
      }),
    ).rejects.toThrow("database down");
    expect(storage.removePublished).toHaveBeenCalledWith("C:\\published");
    expect(storage.removeSession).not.toHaveBeenCalled();
  });

  it("rejects visibility changes for unknown episodes", async () => {
    const { service } = makeDependencies();

    await expect(
      service.setEpisodeVisibility("missing", "public"),
    ).rejects.toMatchObject({ code: "EPISODE_NOT_FOUND", status: 404 });
  });

  it("replaces episode pages and cleans up the previous manuscript", async () => {
    const { service, repository, storage } = makeDependencies();

    const replaced = await service.replaceEpisodePages("episode-12", {
      sessionId: session.id,
      pageIds: session.pages.map((page) => page.id),
    });

    expect(storage.publish).toHaveBeenCalledWith(
      session,
      expect.arrayContaining(["moonlight-laundry", "s1"]),
      session.pages.map((page) => page.id),
    );
    expect(repository.replaceEpisodePages).toHaveBeenCalledWith(
      "episode-12",
      ["/api/images/1.png", "/api/images/2.png"],
      "C:\\published",
    );
    expect(storage.removeSession).toHaveBeenCalledWith(session.id);
    expect(storage.removePublished).toHaveBeenCalledWith(
      "C:\\old-manuscript",
    );
    expect(replaced.pageCount).toBe(2);
    expect(replaced.readerUrl).toBe("/read/episode-12");
  });

  it("keeps the previous manuscript if the page swap fails", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.replaceEpisodePages.mockRejectedValue(
      new Error("database down"),
    );

    await expect(
      service.replaceEpisodePages("episode-12", {
        sessionId: session.id,
        pageIds: session.pages.map((page) => page.id),
      }),
    ).rejects.toThrow("database down");
    expect(storage.removePublished).toHaveBeenCalledWith("C:\\published");
    expect(storage.removePublished).not.toHaveBeenCalledWith(
      "C:\\old-manuscript",
    );
    expect(storage.removeSession).not.toHaveBeenCalled();
  });

  it("rejects page replacement for unknown episodes", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.findEpisode.mockResolvedValue(null);

    await expect(
      service.replaceEpisodePages("missing", {
        sessionId: session.id,
        pageIds: session.pages.map((page) => page.id),
      }),
    ).rejects.toMatchObject({ code: "EPISODE_NOT_FOUND", status: 404 });
    expect(storage.publish).not.toHaveBeenCalled();
  });

  it("rejects updates for unknown episodes", async () => {
    const { service } = makeDependencies();

    await expect(
      service.updateEpisode("missing", { title: "새 제목" }),
    ).rejects.toMatchObject({ code: "EPISODE_NOT_FOUND", status: 404 });
  });

  it("maps duplicate episode numbers to a conflict", async () => {
    const { service, repository } = makeDependencies();
    repository.updateEpisode.mockRejectedValue(
      new StudioRepositoryError("EPISODE_NUMBER_EXISTS"),
    );

    await expect(
      service.updateEpisode("episode-12", { number: 3 }),
    ).rejects.toMatchObject({
      code: "EPISODE_NUMBER_EXISTS",
      status: 409,
    });
  });

  it("blocks deleting an episode that paid readers unlocked", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.countCandyEntitlements.mockResolvedValue(2);

    await expect(service.deleteEpisode("episode-12")).rejects.toMatchObject(
      { code: "EPISODE_HAS_PAID_READERS", status: 409 },
    );
    expect(repository.deleteEpisode).not.toHaveBeenCalled();
    expect(storage.removePublished).not.toHaveBeenCalled();
  });

  it("processes and stores a series cover image", async () => {
    const { service, repository, storage } = makeDependencies();
    const png = await sharp({
      create: {
        width: 8,
        height: 12,
        channels: 3,
        background: { r: 240, g: 120, b: 80 },
      },
    })
      .png()
      .toBuffer();

    const updated = await service.updateSeriesCover("series-1", png);

    expect(storage.publishCover).toHaveBeenCalledWith(
      "series-1",
      expect.any(Buffer),
    );
    expect(repository.updateSeriesCover).toHaveBeenCalledWith(
      "series-1",
      "/api/images/studio/covers/series-1-cover.webp",
    );
    expect(updated.coverUrl).toContain("covers");
  });

  it("rejects a cover that is not a raster image", async () => {
    const { service, storage } = makeDependencies();

    await expect(
      service.updateSeriesCover("series-1", Buffer.from("<svg></svg>")),
    ).rejects.toMatchObject({ status: 400 });
    expect(storage.publishCover).not.toHaveBeenCalled();
  });

  it("updates series display info without touching the slug", async () => {
    const { service, repository } = makeDependencies();
    repository.updateSeriesInfo.mockResolvedValue({
      seriesId: "series-1",
      slug: "moonlight-laundry",
      title: "달빛 세탁소 리마스터",
      synopsis: "새 줄거리",
    });

    const updated = await service.updateSeriesInfo("series-1", {
      title: "달빛 세탁소 리마스터",
      synopsis: "새 줄거리",
    });

    expect(updated.slug).toBe("moonlight-laundry");
    expect(updated.title).toBe("달빛 세탁소 리마스터");
  });

  it("rejects series info changes for unknown series", async () => {
    const { service } = makeDependencies();

    await expect(
      service.updateSeriesInfo("missing", { title: "새 제목" }),
    ).rejects.toMatchObject({ code: "SERIES_NOT_FOUND", status: 404 });
  });

  it("maps duplicate slugs to a conflict when creating a series", async () => {
    const { service, repository } = makeDependencies();
    repository.createSeries.mockRejectedValue(
      new StudioRepositoryError("SERIES_SLUG_EXISTS"),
    );

    await expect(
      service.createSeries({
        slug: "moonlight-laundry",
        title: "달빛 세탁소",
        synopsis: "줄거리",
        genre: "일상",
        weekday: "mon",
        authorName: "새 작가",
      }),
    ).rejects.toMatchObject({ code: "SERIES_SLUG_EXISTS", status: 409 });
  });

  it("deletes an episode and cleans up its manuscript files", async () => {
    const { service, repository, storage } = makeDependencies();

    await service.deleteEpisode("episode-12");

    expect(repository.deleteEpisode).toHaveBeenCalledWith("episode-12");
    expect(storage.removePublished).toHaveBeenCalledWith(
      "C:\\old-manuscript",
    );
  });

  it("moves a packaging request along the allowed transitions", async () => {
    const { service } = makeDependencies();

    const updated = await service.updatePackagingStatus(
      "packaging-1",
      "reviewing",
    );

    expect(updated.status).toBe("reviewing");
  });

  it("rejects skipping ahead in the packaging flow", async () => {
    const { service, repository } = makeDependencies();

    await expect(
      service.updatePackagingStatus("packaging-1", "completed"),
    ).rejects.toMatchObject({
      code: "PACKAGING_TRANSITION_INVALID",
      status: 409,
    });
    expect(repository.updatePackagingStatus).not.toHaveBeenCalled();
  });

  it("rejects reopening a canceled packaging request", async () => {
    const { service, repository } = makeDependencies();
    repository.findPackagingRequest.mockResolvedValue({
      id: "packaging-1",
      applicantName: "박야근",
      bookTitle: "야근의 기록",
      bookSize: "A5",
      coverType: "softcover",
      quantity: 30,
      memo: null,
      pageCount: 2,
      status: "canceled",
      createdAt: "2026-07-27T00:00:00.000Z",
    });

    await expect(
      service.updatePackagingStatus("packaging-1", "reviewing"),
    ).rejects.toMatchObject({ code: "PACKAGING_TRANSITION_INVALID" });
  });

  it("rejects season status changes for unknown seasons", async () => {
    const { service, repository } = makeDependencies();
    repository.updateSeasonStatus.mockResolvedValue(null);

    await expect(
      service.updateSeasonStatus("missing", "completed"),
    ).rejects.toMatchObject({ code: "SEASON_NOT_FOUND", status: 404 });
  });

  it("rejects deleting an unknown episode", async () => {
    const { service, repository, storage } = makeDependencies();
    repository.findEpisode.mockResolvedValue(null);

    await expect(service.deleteEpisode("missing")).rejects.toMatchObject({
      code: "EPISODE_NOT_FOUND",
      status: 404,
    });
    expect(repository.deleteEpisode).not.toHaveBeenCalled();
    expect(storage.removePublished).not.toHaveBeenCalled();
  });
});
