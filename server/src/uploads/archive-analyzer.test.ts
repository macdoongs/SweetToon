import AdmZip from "adm-zip";
import sharp from "sharp";
import {
  analyzeArchive,
  ArchiveValidationError,
} from "./archive-analyzer";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function archive(entries: Array<[string, Buffer]>): Buffer {
  const zip = new AdmZip();
  for (const [name, data] of entries) {
    zip.addFile(name, data);
  }
  return zip.toBuffer();
}

function withDeclaredUncompressedSize(
  source: Buffer,
  uncompressedSize: number,
): Buffer {
  const buffer = Buffer.from(source);
  const localHeader = buffer.indexOf(
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  );
  const centralHeader = buffer.indexOf(
    Buffer.from([0x50, 0x4b, 0x01, 0x02]),
  );
  if (localHeader < 0 || centralHeader < 0) {
    throw new Error("ZIP headers missing from test archive");
  }
  buffer.writeUInt32LE(uncompressedSize, localHeader + 22);
  buffer.writeUInt32LE(uncompressedSize, centralHeader + 24);
  return buffer;
}

async function expectCode(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
    throw new Error("Expected archive validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ArchiveValidationError);
    expect(error).toMatchObject({ code });
  }
}

describe("analyzeArchive", () => {
  it("naturally sorts raster pages by their original file names", async () => {
    const images = await analyzeArchive(
      archive([
        ["10.png", png],
        ["2.png", png],
        ["1.png", png],
      ]),
    );

    expect(images.map((image) => image.originalName)).toEqual([
      "1.png",
      "2.png",
      "10.png",
    ]);
  });

  it("rejects unsupported files including SVG", async () => {
    await expectCode(
      () =>
        analyzeArchive(
          archive([
            ["1.png", png],
            ["2.svg", Buffer.from("<svg></svg>")],
          ]),
        ),
      "UNSUPPORTED_ARCHIVE_FILE",
    );
  });

  it("rejects files whose extension does not match the signature", async () => {
    await expectCode(
      () => analyzeArchive(archive([["1.jpg", png]])),
      "IMAGE_SIGNATURE_MISMATCH",
    );
  });

  it("rejects a zero declared size before accepting an image entry", async () => {
    await expectCode(
      () =>
        analyzeArchive(
          withDeclaredUncompressedSize(
            archive([["1.png", png]]),
            0,
          ),
        ),
      "IMAGE_SIZE_INVALID",
    );
  });

  it("rejects unsafe traversal paths", async () => {
    const zip = new AdmZip();
    zip.addFile("safe.png", png);
    const entry = zip.getEntry("safe.png");
    if (!entry) throw new Error("test entry missing");
    entry.entryName = "../safe.png";

    await expectCode(
      () => analyzeArchive(zip.toBuffer()),
      "UNSAFE_ARCHIVE_PATH",
    );
  });

  it("rejects a non-ZIP payload", async () => {
    await expectCode(
      () => analyzeArchive(Buffer.from("not a zip")),
      "ARCHIVE_INVALID",
    );
  });

  it("rejects a file that has a valid signature but cannot be decoded", async () => {
    const signatureOnly = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);

    await expectCode(
      () => analyzeArchive(archive([["broken.png", signatureOnly]])),
      "IMAGE_DECODE_FAILED",
    );
  });

  it("rejects images that exceed the configured dimensions", async () => {
    const oversized = await sharp({
      create: {
        width: 8_001,
        height: 1,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();

    await expectCode(
      () => analyzeArchive(archive([["too-wide.png", oversized]])),
      "IMAGE_DIMENSIONS_TOO_LARGE",
    );
  });
});
