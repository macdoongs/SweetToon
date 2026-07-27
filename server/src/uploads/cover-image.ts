import sharp from "sharp";
import { ARCHIVE_LIMITS } from "./archive-analyzer";

export const COVER_IMAGE_WIDTH = 900;
export const COVER_IMAGE_QUALITY = 82;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class CoverValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CoverValidationError";
  }
}

// 원고 이미지와 같은 래스터 정책을 적용하고 표지 폭 기준 WebP로 통일한다.
export async function processCoverImage(buffer: Buffer): Promise<Buffer> {
  if (buffer.length === 0 || buffer.length > COVER_MAX_BYTES) {
    throw new CoverValidationError(
      "COVER_TOO_LARGE",
      "표지 이미지는 5MB 이하로 올려 주세요.",
    );
  }
  try {
    const image = sharp(buffer, {
      failOn: "error",
      limitInputPixels: ARCHIVE_LIMITS.maxImagePixels,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new CoverValidationError(
        "COVER_FORMAT_INVALID",
        "표지는 PNG, JPG, WebP 이미지만 쓸 수 있어요.",
      );
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new CoverValidationError(
        "COVER_ANIMATED",
        "움직이는 이미지는 표지로 쓸 수 없어요.",
      );
    }
    return await image
      .rotate()
      .resize({ width: COVER_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ effort: 4, quality: COVER_IMAGE_QUALITY })
      .toBuffer();
  } catch (error) {
    if (error instanceof CoverValidationError) throw error;
    throw new CoverValidationError(
      "COVER_IMAGE_INVALID",
      "표지 이미지를 읽지 못했습니다. 다른 파일로 시도해 주세요.",
    );
  }
}
