import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../app";
import type { ReaderRepository } from "../repositories/reader-repository";
import type { StudioUseCases } from "../services/studio-service";
import type { SecurityAuditLogger } from "../security/audit-logger";

const sessionId = "a62ba8b5-f8aa-4220-a849-55a49be66f5a";
const pageId = "b74fb5ce-d837-40a6-ab85-e34f67f8668f";

function readerRepository(): ReaderRepository {
  return {
    listSeries: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      nextPage: null,
      total: 0,
      facets: { genres: [], weekdays: [] },
    }),
    listRealtimeSeriesKeys: jest.fn().mockResolvedValue([]),
    listRealtimeSeries: jest.fn().mockResolvedValue([]),
    seriesExists: jest.fn().mockResolvedValue(false),
    findSeriesBySlug: jest.fn().mockResolvedValue(null),
    findEpisodeById: jest.fn().mockResolvedValue(null),
  };
}

function studioService(): jest.Mocked<StudioUseCases> {
  return {
    previewArchive: jest.fn().mockResolvedValue({
      sessionId,
      originalName: "episode.zip",
      expiresAt: "2026-07-24T01:00:00.000Z",
      pages: [
        {
          id: pageId,
          originalName: "1.png",
          previewUrl: `/api/studio/uploads/${sessionId}/pages/${pageId}`,
          byteSize: 100,
        },
      ],
    }),
    getPreviewPath: jest.fn().mockResolvedValue("C:\\preview.png"),
    createEpisode: jest.fn().mockResolvedValue({
      episodeId: "episode-12",
      seriesSlug: "moonlight-laundry",
      pageCount: 1,
      readerUrl: "/read/episode-12",
      visibility: "public",
    }),
    cancelUpload: jest.fn().mockResolvedValue(undefined),
    updateAccessPolicy: jest.fn().mockResolvedValue({
      seriesId: "series-1",
      freeVolumeCount: 1,
      previewEpisodeCount: 2,
    }),
    setEpisodeVisibility: jest.fn().mockResolvedValue({
      id: "episode-12",
      number: 12,
      title: "새벽의 손님",
      publishedAt: "2026-07-24T00:00:00.000Z",
      season: { id: "season-1", number: 1 },
      series: { slug: "moonlight-laundry", title: "달빛 세탁소" },
    }),
    updateSeriesInfo: jest.fn().mockResolvedValue({
      seriesId: "series-1",
      slug: "moonlight-laundry",
      title: "달빛 세탁소 리마스터",
      synopsis: "새 줄거리",
    }),
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
    updatePackagingStatus: jest.fn().mockResolvedValue({
      id: "packaging-1",
      applicantName: "박야근",
      bookTitle: "야근의 기록",
      bookSize: "A5",
      coverType: "softcover",
      quantity: 30,
      memo: null,
      pageCount: 1,
      status: "reviewing",
      createdAt: "2026-07-27T00:00:00.000Z",
    }),
    deleteEpisode: jest.fn().mockResolvedValue(undefined),
    updateEpisode: jest.fn().mockResolvedValue({
      id: "episode-12",
      number: 13,
      title: "고친 제목",
      publishedAt: "2026-07-24T00:00:00.000Z",
      season: { id: "season-1", number: 1 },
      series: { slug: "moonlight-laundry", title: "달빛 세탁소" },
    }),
    updateSeriesCover: jest.fn().mockResolvedValue({
      seriesId: "series-1",
      coverUrl: "/api/images/studio/covers/series-1-cover.webp",
    }),
    replaceEpisodePages: jest.fn().mockResolvedValue({
      episodeId: "episode-12",
      seriesSlug: "moonlight-laundry",
      pageCount: 1,
      readerUrl: "/read/episode-12",
      visibility: "public",
    }),
    listDraftEpisodes: jest.fn().mockResolvedValue([]),
    createPackagingRequest: jest.fn().mockResolvedValue({
      id: "packaging-1",
      applicantName: "박야근",
      bookTitle: "야근의 기록",
      bookSize: "A5",
      coverType: "softcover",
      quantity: 30,
      memo: null,
      pageCount: 1,
      status: "received",
      createdAt: "2026-07-27T00:00:00.000Z",
    }),
    listPackagingRequests: jest.fn().mockResolvedValue([]),
  };
}

function app(
  service = studioService(),
  auditLogger?: SecurityAuditLogger,
) {
  return createApp({
    readerRepository: readerRepository(),
    studioService: service,
    auditLogger,
    uploadDir: path.join(os.tmpdir(), "sweettoon-studio-route-tests"),
  });
}

describe("studio routes", () => {
  it("records a minimal security audit event for upload attempts", async () => {
    const auditLogger: jest.Mocked<SecurityAuditLogger> = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    await request(app(studioService(), auditLogger))
      .post("/api/studio/uploads")
      .attach("archive", Buffer.from("PK archive"), "episode.zip")
      .expect(201);
    await new Promise((resolve) => setImmediate(resolve));

    expect(auditLogger.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "studio.upload.preview",
        outcome: "allowed",
        statusCode: 201,
      }),
    );
  });

  it("updates a creator-defined free reading policy", async () => {
    const service = studioService();
    const response = await request(app(service))
      .patch("/api/studio/series/series-1/access-policy")
      .send({ freeVolumeCount: 1, previewEpisodeCount: 2 })
      .expect(200);

    expect(response.body).toEqual({
      seriesId: "series-1",
      freeVolumeCount: 1,
      previewEpisodeCount: 2,
    });
    expect(service.updateAccessPolicy).toHaveBeenCalledWith("series-1", {
      freeVolumeCount: 1,
      previewEpisodeCount: 2,
    });
  });

  it("accepts one ZIP archive and returns a preview session", async () => {
    const service = studioService();
    const response = await request(app(service))
      .post("/api/studio/uploads")
      .attach("archive", Buffer.from("PK archive"), "episode.zip")
      .expect(201);

    expect(service.previewArchive).toHaveBeenCalledWith(
      "episode.zip",
      expect.any(Buffer),
    );
    expect(response.body.pages[0].originalName).toBe("1.png");
  });

  it("rejects unsupported archive extensions", async () => {
    const response = await request(app())
      .post("/api/studio/uploads")
      .attach("archive", Buffer.from("PK archive"), "episode.rar")
      .expect(400);

    expect(response.body.code).toBe("ARCHIVE_EXTENSION_INVALID");
  });

  it("rate-limits repeated archive uploads from one client", async () => {
    const application = app();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(application)
        .post("/api/studio/uploads")
        .expect(400);
    }
    const response = await request(application)
      .post("/api/studio/uploads")
      .expect(429);

    expect(response.body.code).toBe("UPLOAD_RATE_LIMITED");
  });

  it("validates episode metadata and confirmed page order", async () => {
    const service = studioService();
    const response = await request(app(service))
      .post("/api/studio/episodes")
      .send({
        sessionId,
        seasonId: "season-1",
        number: 12,
        title: "새벽의 손님",
        pageIds: [pageId],
      })
      .expect(201);

    expect(service.createEpisode).toHaveBeenCalled();
    expect(response.body.readerUrl).toBe("/read/episode-12");
  });

  it("forwards the requested visibility when publishing an episode", async () => {
    const service = studioService();
    await request(app(service))
      .post("/api/studio/episodes")
      .send({
        sessionId,
        seasonId: "season-1",
        number: 12,
        title: "새벽의 손님",
        pageIds: [pageId],
        visibility: "private",
      })
      .expect(201);

    expect(service.createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "private" }),
    );
  });

  it("toggles episode visibility", async () => {
    const service = studioService();
    const response = await request(app(service))
      .patch("/api/studio/episodes/episode-12/visibility")
      .send({ visibility: "public" })
      .expect(200);

    expect(service.setEpisodeVisibility).toHaveBeenCalledWith(
      "episode-12",
      "public",
    );
    expect(response.body.id).toBe("episode-12");
  });

  it("rejects unknown visibility values", async () => {
    const response = await request(app())
      .patch("/api/studio/episodes/episode-12/visibility")
      .send({ visibility: "secret" })
      .expect(400);

    expect(response.body.code).toBe("INVALID_EPISODE_VISIBILITY");
  });

  it("completes a season and starts the next one", async () => {
    const service = studioService();
    const application = app(service);
    const completed = await request(application)
      .patch("/api/studio/seasons/season-1/status")
      .send({ status: "completed" })
      .expect(200);
    const created = await request(application)
      .post("/api/studio/series/series-1/seasons")
      .expect(201);

    expect(completed.body.status).toBe("completed");
    expect(service.updateSeasonStatus).toHaveBeenCalledWith(
      "season-1",
      "completed",
    );
    expect(created.body.number).toBe(2);
  });

  it("rejects unknown season status values", async () => {
    const response = await request(app())
      .patch("/api/studio/seasons/season-1/status")
      .send({ status: "paused" })
      .expect(400);

    expect(response.body.code).toBe("INVALID_SEASON_STATUS");
  });

  it("moves a packaging request to the next operator step", async () => {
    const service = studioService();
    const response = await request(app(service))
      .patch("/api/studio/packaging-requests/packaging-1/status")
      .send({ status: "reviewing" })
      .expect(200);

    expect(service.updatePackagingStatus).toHaveBeenCalledWith(
      "packaging-1",
      "reviewing",
    );
    expect(response.body.status).toBe("reviewing");
  });

  it("rejects setting a packaging request back to received", async () => {
    const response = await request(app())
      .patch("/api/studio/packaging-requests/packaging-1/status")
      .send({ status: "received" })
      .expect(400);

    expect(response.body.code).toBe("INVALID_PACKAGING_STATUS");
  });

  it("creates a new series with its first season", async () => {
    const service = studioService();
    const response = await request(app(service))
      .post("/api/studio/series")
      .send({
        slug: "night-market",
        title: "야시장",
        synopsis: "밤에만 열리는 시장 이야기",
        genre: "판타지",
        weekday: "fri",
        authorName: "새 작가",
      })
      .expect(201);

    expect(service.createSeries).toHaveBeenCalled();
    expect(response.body.seasonId).toBe("season-2");
  });

  it("rejects a series with an invalid slug", async () => {
    const response = await request(app())
      .post("/api/studio/series")
      .send({
        slug: "한글주소",
        title: "야시장",
        synopsis: "줄거리",
        genre: "판타지",
        weekday: "fri",
        authorName: "새 작가",
      })
      .expect(400);

    expect(response.body.code).toBe("INVALID_SERIES");
  });

  it("deletes an episode", async () => {
    const service = studioService();
    await request(app(service))
      .delete("/api/studio/episodes/episode-12")
      .expect(204);

    expect(service.deleteEpisode).toHaveBeenCalledWith("episode-12");
  });

  it("updates series display info", async () => {
    const service = studioService();
    const response = await request(app(service))
      .patch("/api/studio/series/series-1")
      .send({ title: "달빛 세탁소 리마스터" })
      .expect(200);

    expect(service.updateSeriesInfo).toHaveBeenCalledWith("series-1", {
      title: "달빛 세탁소 리마스터",
    });
    expect(response.body.slug).toBe("moonlight-laundry");
  });

  it("rejects a series info update without any field", async () => {
    const response = await request(app())
      .patch("/api/studio/series/series-1")
      .send({})
      .expect(400);

    expect(response.body.code).toBe("INVALID_SERIES_INFO");
  });

  it("updates an episode title and number in one request", async () => {
    const service = studioService();
    const response = await request(app(service))
      .patch("/api/studio/episodes/episode-12")
      .send({ title: "고친 제목", number: 13 })
      .expect(200);

    expect(service.updateEpisode).toHaveBeenCalledWith("episode-12", {
      title: "고친 제목",
      number: 13,
    });
    expect(response.body.number).toBe(13);
  });

  it("rejects an episode update without any field", async () => {
    const response = await request(app())
      .patch("/api/studio/episodes/episode-12")
      .send({})
      .expect(400);

    expect(response.body.code).toBe("INVALID_EPISODE_UPDATE");
  });

  it("uploads a series cover image", async () => {
    const service = studioService();
    const response = await request(app(service))
      .post("/api/studio/series/series-1/cover")
      .attach("cover", Buffer.from("fake image"), "cover.png")
      .expect(200);

    expect(service.updateSeriesCover).toHaveBeenCalledWith(
      "series-1",
      expect.any(Buffer),
    );
    expect(response.body.coverUrl).toContain("covers");
  });

  it("rejects a cover upload without a file", async () => {
    const response = await request(app())
      .post("/api/studio/series/series-1/cover")
      .expect(400);

    expect(response.body.code).toBe("COVER_REQUIRED");
  });

  it("replaces episode pages from a new upload session", async () => {
    const service = studioService();
    const response = await request(app(service))
      .patch("/api/studio/episodes/episode-12/pages")
      .send({ sessionId, pageIds: [pageId] })
      .expect(200);

    expect(service.replaceEpisodePages).toHaveBeenCalledWith("episode-12", {
      sessionId,
      pageIds: [pageId],
    });
    expect(response.body.readerUrl).toBe("/read/episode-12");
  });

  it("rejects a page replacement without a valid session", async () => {
    const response = await request(app())
      .patch("/api/studio/episodes/episode-12/pages")
      .send({ sessionId: "not-a-uuid", pageIds: [pageId] })
      .expect(400);

    expect(response.body.code).toBe("INVALID_PAGE_REPLACEMENT");
  });

  it("accepts a packaging service request", async () => {
    const service = studioService();
    const response = await request(app(service))
      .post("/api/studio/packaging-requests")
      .send({
        sessionId,
        pageIds: [pageId],
        applicantName: "박야근",
        bookTitle: "야근의 기록",
        bookSize: "A5",
        coverType: "softcover",
        quantity: 30,
        memo: "독립출판 마켓용",
      })
      .expect(201);

    expect(service.createPackagingRequest).toHaveBeenCalled();
    expect(response.body.status).toBe("received");
  });

  it("rejects a packaging request without book details", async () => {
    const response = await request(app())
      .post("/api/studio/packaging-requests")
      .send({ sessionId, pageIds: [pageId] })
      .expect(400);

    expect(response.body.code).toBe("INVALID_PACKAGING_REQUEST");
  });

  it("lists drafts and packaging requests for the studio", async () => {
    const service = studioService();
    const application = app(service);
    const drafts = await request(application)
      .get("/api/studio/drafts")
      .expect(200);
    const packaging = await request(application)
      .get("/api/studio/packaging-requests")
      .expect(200);

    expect(drafts.body).toEqual({ items: [] });
    expect(packaging.body).toEqual({ items: [] });
  });

  it("cleans up a canceled upload session", async () => {
    const service = studioService();
    await request(app(service))
      .delete(`/api/studio/uploads/${sessionId}`)
      .expect(204);

    expect(service.cancelUpload).toHaveBeenCalledWith(sessionId);
  });
});
