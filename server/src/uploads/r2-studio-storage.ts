import path from "node:path";
import { promises as fs } from "node:fs";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { ARCHIVE_LIMITS, type AnalyzedImage } from "./archive-analyzer";
import {
  FileStudioStorage,
  READER_IMAGE_QUALITY,
  READER_IMAGE_WIDTH,
  type PublishedFiles,
  type StudioStorage,
  type UploadSession,
} from "./upload-session-storage";

type R2StudioStorageOptions = {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
  stagingDir: string;
};

function safeSegments(segments: string[]): string[] {
  return segments.map((segment) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
      throw new Error("Unsafe storage destination");
    }
    return segment;
  });
}

function contentType(extension: string): string {
  switch (extension.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/**
 * Keeps short-lived ZIP previews on local disk and publishes immutable
 * originals/reader derivatives to Cloudflare R2 through its S3 API.
 */
export class R2StudioStorage implements StudioStorage {
  private readonly staging: FileStudioStorage;
  private readonly publicBaseUrl: string;

  constructor(private readonly options: R2StudioStorageOptions) {
    this.staging = new FileStudioStorage(options.stagingDir);
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
  }

  createSession(
    originalName: string,
    images: AnalyzedImage[],
  ): Promise<UploadSession> {
    return this.staging.createSession(originalName, images);
  }

  getSession(sessionId: string): Promise<UploadSession | null> {
    return this.staging.getSession(sessionId);
  }

  getPreviewPath(
    sessionId: string,
    pageId: string,
  ): Promise<string | null> {
    return this.staging.getPreviewPath(sessionId, pageId);
  }

  removeSession(sessionId: string): Promise<void> {
    return this.staging.removeSession(sessionId);
  }

  cleanupExpired(): Promise<void> {
    return this.staging.cleanupExpired();
  }

  async publish(
    session: UploadSession,
    destinationSegments: string[],
    orderedPageIds: string[],
  ): Promise<PublishedFiles> {
    const prefix = `studio/${safeSegments(destinationSegments).join("/")}`;
    const imageUrls: string[] = [];
    try {
      for (const [index, pageId] of orderedPageIds.entries()) {
        const page = session.pages.find((candidate) => candidate.id === pageId);
        const sourcePath = await this.staging.getSourcePath(
          session.id,
          pageId,
        );
        if (!page || !sourcePath) throw new Error("Unknown staged page");

        const baseName = String(index + 1).padStart(3, "0");
        const extension = path.extname(page.storedName).toLowerCase();
        const originalKey = `${prefix}/.original/${baseName}${extension}`;
        const readerKey = `${prefix}/reader/${baseName}.webp`;
        const readerImage = await sharp(sourcePath, {
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
          .toBuffer();

        await this.options.client.send(
          new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: originalKey,
            Body: await fs.readFile(sourcePath),
            ContentType: contentType(extension),
            CacheControl: "private, max-age=0, no-store",
          }),
        );
        await this.options.client.send(
          new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: readerKey,
            Body: readerImage,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
        imageUrls.push(`${this.publicBaseUrl}/${readerKey}`);
      }
      return {
        directory: `r2://${this.options.bucket}/${prefix}`,
        imageUrls,
      };
    } catch (error) {
      await this.removePrefix(prefix);
      throw error;
    }
  }

  async removePublished(directory: string): Promise<void> {
    const expected = `r2://${this.options.bucket}/studio/`;
    if (!directory.startsWith(expected)) return;
    await this.removePrefix(directory.slice(`r2://${this.options.bucket}/`.length));
  }

  private async removePrefix(prefix: string): Promise<void> {
    let continuationToken: string | undefined;
    do {
      const listed = await this.options.client.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: `${prefix.replace(/\/+$/, "")}/`,
          ContinuationToken: continuationToken,
        }),
      );
      const objects = (listed.Contents ?? [])
        .map(({ Key }) => Key)
        .filter((Key): Key is string => Boolean(Key))
        .map((Key) => ({ Key }));
      if (objects.length > 0) {
        await this.options.client.send(
          new DeleteObjectsCommand({
            Bucket: this.options.bucket,
            Delete: { Objects: objects, Quiet: true },
          }),
        );
      }
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }
}
