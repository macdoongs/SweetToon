import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { FileStudioStorage } from "./upload-session-storage";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("FileStudioStorage publication", () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "sweettoon-images-"));
  });

  afterEach(() => {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("keeps the source and publishes a metadata-free WebP reader image", async () => {
    const storage = new FileStudioStorage(uploadDir);
    const session = await storage.createSession("episode.cbz", [
      {
        originalName: "1.png",
        extension: "png",
        data: png,
      },
    ]);

    const published = await storage.publish(
      session,
      ["moonlight-laundry", "s1", "ep1-publication"],
      [session.pages[0].id],
    );

    expect(published.imageUrls).toEqual([
      "/api/images/studio/moonlight-laundry/s1/ep1-publication/reader/001.webp",
    ]);
    expect(
      fs.existsSync(path.join(published.directory, ".original", "001.png")),
    ).toBe(true);

    const readerPath = path.join(
      published.directory,
      "reader",
      "001.webp",
    );
    const metadata = await sharp(
      await fs.promises.readFile(readerPath),
    ).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);

    await storage.removePublished(published.directory);
    expect(fs.existsSync(published.directory)).toBe(false);
  });
});
