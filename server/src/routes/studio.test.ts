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
    }),
    cancelUpload: jest.fn().mockResolvedValue(undefined),
    updateAccessPolicy: jest.fn().mockResolvedValue({
      seriesId: "series-1",
      freeVolumeCount: 1,
      previewEpisodeCount: 2,
    }),
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

  it("cleans up a canceled upload session", async () => {
    const service = studioService();
    await request(app(service))
      .delete(`/api/studio/uploads/${sessionId}`)
      .expect(204);

    expect(service.cancelUpload).toHaveBeenCalledWith(sessionId);
  });
});
