import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  ARCHIVE_LIMITS,
  type AnalyzedImage,
} from "./archive-analyzer";

const SESSION_TTL_MS = 60 * 60 * 1000;
export const READER_IMAGE_WIDTH = 1_600;
export const READER_IMAGE_QUALITY = 82;

export type StoredPage = {
  id: string;
  originalName: string;
  storedName: string;
  byteSize: number;
};

export type UploadSession = {
  id: string;
  originalName: string;
  createdAt: string;
  expiresAt: string;
  pages: StoredPage[];
};

export type PublishedFiles = {
  directory: string;
  imageUrls: string[];
};

export type PublishedCover = {
  url: string;
  location: string;
};

export interface StudioStorage {
  createSession(
    originalName: string,
    images: AnalyzedImage[],
  ): Promise<UploadSession>;
  getSession(sessionId: string): Promise<UploadSession | null>;
  getPreviewPath(
    sessionId: string,
    pageId: string,
  ): Promise<string | null>;
  publish(
    session: UploadSession,
    destinationSegments: string[],
    orderedPageIds: string[],
  ): Promise<PublishedFiles>;
  publishCover(seriesId: string, webp: Buffer): Promise<PublishedCover>;
  removeSession(sessionId: string): Promise<void>;
  removePublished(directory: string): Promise<void>;
  cleanupExpired(): Promise<void>;
}

function sessionSchema(value: unknown): value is UploadSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UploadSession>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.originalName === "string" &&
    typeof candidate.expiresAt === "string" &&
    Array.isArray(candidate.pages)
  );
}

export class FileStudioStorage implements StudioStorage {
  private readonly stagingDir: string;

  constructor(private readonly uploadDir: string) {
    this.stagingDir = path.join(uploadDir, ".staging");
    fs.mkdirSync(this.stagingDir, { recursive: true });
  }

  private sessionDir(sessionId: string): string {
    return path.join(this.stagingDir, sessionId);
  }

  private manifestPath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "manifest.json");
  }

  async createSession(
    originalName: string,
    images: AnalyzedImage[],
  ): Promise<UploadSession> {
    await this.cleanupExpired();
    const id = crypto.randomUUID();
    const directory = this.sessionDir(id);
    fs.mkdirSync(directory, { recursive: false });
    try {
      const pages = images.map((image) => {
        const pageId = crypto.randomUUID();
        const storedName = `${pageId}.${image.extension}`;
        fs.writeFileSync(path.join(directory, storedName), image.data, {
          flag: "wx",
        });
        return {
          id: pageId,
          originalName: image.originalName,
          storedName,
          byteSize: image.data.length,
        };
      });
      const now = new Date();
      const session: UploadSession = {
        id,
        originalName,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
        pages,
      };
      fs.writeFileSync(
        this.manifestPath(id),
        JSON.stringify(session),
        { encoding: "utf8", flag: "wx" },
      );
      return session;
    } catch (error) {
      fs.rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<UploadSession | null> {
    try {
      const value = JSON.parse(
        fs.readFileSync(this.manifestPath(sessionId), "utf8"),
      ) as unknown;
      if (!sessionSchema(value)) return null;
      if (Date.parse(value.expiresAt) <= Date.now()) {
        await this.removeSession(sessionId);
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  async getPreviewPath(
    sessionId: string,
    pageId: string,
  ): Promise<string | null> {
    const session = await this.getSession(sessionId);
    const page = session?.pages.find((candidate) => candidate.id === pageId);
    if (!page) return null;
    const candidate = path.resolve(this.sessionDir(sessionId), page.storedName);
    const root = `${path.resolve(this.sessionDir(sessionId))}${path.sep}`;
    return candidate.startsWith(root) && fs.existsSync(candidate)
      ? candidate
      : null;
  }

  async getSourcePath(
    sessionId: string,
    pageId: string,
  ): Promise<string | null> {
    return this.getPreviewPath(sessionId, pageId);
  }

  async publish(
    session: UploadSession,
    destinationSegments: string[],
    orderedPageIds: string[],
  ): Promise<PublishedFiles> {
    const safeSegments = destinationSegments.map((segment) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
        throw new Error("Unsafe storage destination");
      }
      return segment;
    });
    const destination = path.join(this.uploadDir, "studio", ...safeSegments);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.mkdirSync(destination, { recursive: false });

    try {
      const originalDirectory = path.join(destination, ".original");
      const readerDirectory = path.join(destination, "reader");
      await fs.promises.mkdir(originalDirectory);
      await fs.promises.mkdir(readerDirectory);

      const imageUrls: string[] = [];
      // Sequential processing bounds libvips memory while a large episode is
      // being published.
      for (const [index, pageId] of orderedPageIds.entries()) {
        const page = session.pages.find((candidate) => candidate.id === pageId);
        if (!page) throw new Error("Unknown staged page");
        const extension = path.extname(page.storedName);
        const baseName = String(index + 1).padStart(3, "0");
        const sourcePath = path.join(
          this.sessionDir(session.id),
          page.storedName,
        );
        await fs.promises.copyFile(
          sourcePath,
          path.join(originalDirectory, `${baseName}${extension}`),
          fs.constants.COPYFILE_EXCL,
        );
        await sharp(sourcePath, {
          failOn: "error",
          limitInputPixels: ARCHIVE_LIMITS.maxImagePixels,
        })
          .rotate()
          .resize({
            width: READER_IMAGE_WIDTH,
            withoutEnlargement: true,
          })
          .webp({
            effort: 4,
            quality: READER_IMAGE_QUALITY,
          })
          .toFile(path.join(readerDirectory, `${baseName}.webp`));
        imageUrls.push(
          `/api/images/studio/${safeSegments.join("/")}/reader/${baseName}.webp`,
        );
      }
      return { directory: destination, imageUrls };
    } catch (error) {
      fs.rmSync(destination, { recursive: true, force: true });
      throw error;
    }
  }

  async publishCover(
    seriesId: string,
    webp: Buffer,
  ): Promise<PublishedCover> {
    if (!/^[a-zA-Z0-9_-]+$/.test(seriesId)) {
      throw new Error("Unsafe storage destination");
    }
    const coverDir = path.join(this.uploadDir, "studio", "covers");
    fs.mkdirSync(coverDir, { recursive: true });
    const fileName = `${seriesId}-${crypto.randomUUID()}.webp`;
    const filePath = path.join(coverDir, fileName);
    fs.writeFileSync(filePath, webp, { flag: "wx" });
    return {
      url: `/api/images/studio/covers/${fileName}`,
      location: filePath,
    };
  }

  async removeSession(sessionId: string): Promise<void> {
    fs.rmSync(this.sessionDir(sessionId), { recursive: true, force: true });
  }

  async removePublished(directory: string): Promise<void> {
    const resolved = path.resolve(directory);
    const root = `${path.resolve(this.uploadDir, "studio")}${path.sep}`;
    if (resolved.startsWith(root)) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  async cleanupExpired(): Promise<void> {
    for (const entry of fs.readdirSync(this.stagingDir, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const session = await this.getSession(entry.name);
      if (!session) {
        fs.rmSync(path.join(this.stagingDir, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }
  }
}
