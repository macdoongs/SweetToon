import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "data", "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// 업로드된 웹툰 이미지 서빙 (시드 SVG + 작가 업로드 컷)
app.use("/api/images", express.static(UPLOAD_DIR, { fallthrough: false }));

app.listen(PORT, () => {
  console.log(`[sweettoon-server] listening on :${PORT}`);
});
