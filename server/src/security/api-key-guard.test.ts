import express from "express";
import request from "supertest";
import { createApiKeyGuard } from "./api-key-guard";

function app(mode: "demo" | "strict") {
  const application = express();
  application.post(
    "/protected",
    createApiKeyGuard({
      mode,
      expectedKey: mode === "strict" ? "correct-horse-battery-staple" : undefined,
      headerName: "x-sweettoon-studio-key",
      code: "STUDIO_ACCESS_DENIED",
      message: "접근 키를 확인해 주세요.",
    }),
    (_req, res) => res.json({ ok: true }),
  );
  return application;
}

describe("API key guard", () => {
  it("keeps the assignment demo flow open in demo mode", async () => {
    await request(app("demo")).post("/protected").expect(200, { ok: true });
  });

  it("rejects missing and incorrect keys in strict mode", async () => {
    const application = app("strict");
    const missing = await request(application).post("/protected").expect(401);
    expect(missing.body.code).toBe("STUDIO_ACCESS_DENIED");
    await request(application)
      .post("/protected")
      .set("x-sweettoon-studio-key", "incorrect")
      .expect(401);
  });

  it("accepts the configured key in strict mode", async () => {
    await request(app("strict"))
      .post("/protected")
      .set(
        "x-sweettoon-studio-key",
        "correct-horse-battery-staple",
      )
      .expect(200, { ok: true });
  });
});
