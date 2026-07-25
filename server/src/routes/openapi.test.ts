import request from "supertest";
import { createApp } from "../app";
import type { ReaderRepository } from "../repositories/reader-repository";

const readerRepository = {
  listSeries: jest.fn(),
  findSeriesBySlug: jest.fn(),
  findEpisodeById: jest.fn(),
} as unknown as ReaderRepository;

describe("OpenAPI documentation", () => {
  const app = createApp({ readerRepository });

  it("serves a machine-readable OpenAPI contract", async () => {
    const response = await request(app).get("/openapi.json").expect(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths).toHaveProperty("/api/episodes/{id}");
    expect(response.body.paths).toHaveProperty(
      "/api/studio/series/{seriesId}/access-policy",
    );
    expect(response.body.paths).toHaveProperty(
      "/api/episodes/{id}/candy-unlock",
    );
    expect(response.body.paths).toHaveProperty("/api/candy-wallets/{token}");
  });

  it("serves the Swagger UI", async () => {
    const response = await request(app).get("/api-docs/").expect(200);
    expect(response.text).toContain('id="swagger-ui"');
    expect(response.text).toContain("SweetToon API");
  });
});
