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
});
