import path from "node:path";
import AdmZip from "adm-zip";

export const ARCHIVE_LIMITS = {
  maxArchiveBytes: 25 * 1024 * 1024,
  maxEntries: 100,
  maxImages: 80,
  maxImageBytes: 12 * 1024 * 1024,
  maxExpandedBytes: 160 * 1024 * 1024,
} as const;

export type RasterKind = "png" | "jpeg" | "webp";

export type AnalyzedImage = {
  originalName: string;
  extension: "png" | "jpg" | "webp";
  data: Buffer;
};

export class ArchiveValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ArchiveValidationError";
  }
}

const naturalCollator = new Intl.Collator("ko", {
  numeric: true,
  sensitivity: "base",
});

function hasUnsafePath(entryName: string): boolean {
  const normalized = entryName.replaceAll("\\", "/");
  return (
    normalized.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  );
}

function isIgnoredMetadata(entryName: string): boolean {
  const normalized = entryName.replaceAll("\\", "/");
  return (
    normalized.startsWith("__MACOSX/") ||
    normalized.split("/").some((segment) => segment === ".DS_Store")
  );
}

function detectRasterKind(data: Buffer): RasterKind | null {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "png";
  }
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function expectedKind(extension: string): RasterKind | null {
  if (extension === ".png") return "png";
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  if (extension === ".webp") return "webp";
  return null;
}

export function analyzeArchive(buffer: Buffer): AnalyzedImage[] {
  if (buffer.length === 0 || buffer.length > ARCHIVE_LIMITS.maxArchiveBytes) {
    throw new ArchiveValidationError(
      "ARCHIVE_SIZE_INVALID",
      "ZIP 파일은 25MB 이하로 올려 주세요.",
    );
  }
  if (
    buffer.length < 4 ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b
  ) {
    throw new ArchiveValidationError(
      "ARCHIVE_INVALID",
      "올바른 ZIP 또는 CBZ 파일이 아닙니다.",
    );
  }

  let archive: AdmZip;
  try {
    archive = new AdmZip(buffer);
  } catch {
    throw new ArchiveValidationError(
      "ARCHIVE_INVALID",
      "압축 파일을 열 수 없습니다. ZIP 파일을 다시 확인해 주세요.",
    );
  }

  const entries = archive.getEntries();
  if (entries.length > ARCHIVE_LIMITS.maxEntries) {
    throw new ArchiveValidationError(
      "TOO_MANY_ARCHIVE_ENTRIES",
      "압축 파일 안의 항목은 100개 이하로 넣어 주세요.",
    );
  }

  const fileEntries = entries.filter(
    (entry) => !entry.isDirectory && !isIgnoredMetadata(entry.entryName),
  );
  if (fileEntries.length === 0) {
    throw new ArchiveValidationError(
      "ARCHIVE_HAS_NO_IMAGES",
      "압축 파일 안에서 이미지를 찾지 못했습니다.",
    );
  }
  if (fileEntries.length > ARCHIVE_LIMITS.maxImages) {
    throw new ArchiveValidationError(
      "TOO_MANY_IMAGES",
      "한 에피소드에는 이미지를 최대 80장까지 등록할 수 있습니다.",
    );
  }

  let expandedBytes = 0;
  let actualExpandedBytes = 0;
  const images = fileEntries.map((entry) => {
    if (hasUnsafePath(entry.entryName)) {
      throw new ArchiveValidationError(
        "UNSAFE_ARCHIVE_PATH",
        "압축 파일에 안전하지 않은 경로가 포함되어 있습니다.",
      );
    }

    const extension = path.extname(entry.entryName).toLowerCase();
    const expected = expectedKind(extension);
    if (!expected) {
      throw new ArchiveValidationError(
        "UNSUPPORTED_ARCHIVE_FILE",
        "PNG, JPG, JPEG, WebP 이미지만 넣어 주세요.",
      );
    }
    // adm-zip only applies zlib's maxOutputLength when the declared size is
    // positive. Reject zero before getData() so every accepted entry has a
    // decompression bound in place before memory is allocated.
    if (entry.header.size === 0) {
      throw new ArchiveValidationError(
        "IMAGE_SIZE_INVALID",
        "비어 있거나 크기를 확인할 수 없는 이미지가 포함되어 있습니다.",
      );
    }
    if (entry.header.size > ARCHIVE_LIMITS.maxImageBytes) {
      throw new ArchiveValidationError(
        "IMAGE_TOO_LARGE",
        "이미지 한 장은 12MB 이하로 넣어 주세요.",
      );
    }
    expandedBytes += entry.header.size;
    if (expandedBytes > ARCHIVE_LIMITS.maxExpandedBytes) {
      throw new ArchiveValidationError(
        "ARCHIVE_EXPANDS_TOO_LARGE",
        "압축을 푼 이미지 전체 크기는 160MB 이하여야 합니다.",
      );
    }

    let data: Buffer;
    try {
      data = entry.getData();
    } catch {
      throw new ArchiveValidationError(
        "ARCHIVE_DAMAGED",
        "손상된 이미지가 있어 압축을 풀 수 없습니다.",
      );
    }
    if (
      data.length === 0 ||
      data.length > ARCHIVE_LIMITS.maxImageBytes
    ) {
      throw new ArchiveValidationError(
        "IMAGE_SIZE_INVALID",
        "비어 있거나 너무 큰 이미지가 포함되어 있습니다.",
      );
    }
    actualExpandedBytes += data.length;
    if (actualExpandedBytes > ARCHIVE_LIMITS.maxExpandedBytes) {
      throw new ArchiveValidationError(
        "ARCHIVE_EXPANDS_TOO_LARGE",
        "압축을 푼 이미지 전체 크기는 160MB 이하여야 합니다.",
      );
    }

    const detected = detectRasterKind(data);
    if (detected !== expected) {
      throw new ArchiveValidationError(
        "IMAGE_SIGNATURE_MISMATCH",
        "확장자와 실제 이미지 형식이 다른 파일이 포함되어 있습니다.",
      );
    }

    return {
      originalName: entry.entryName,
      extension:
        detected === "jpeg"
          ? "jpg"
          : detected,
      data,
    } satisfies AnalyzedImage;
  });

  return images.sort((left, right) =>
    naturalCollator.compare(left.originalName, right.originalName),
  );
}
