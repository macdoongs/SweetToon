import { FileStudioStorage } from "./upload-session-storage";
import { R2StudioStorage } from "./r2-studio-storage";
import { createStudioStorage } from "./studio-storage-factory";

describe("createStudioStorage", () => {
  it("uses local filesystem storage by default", () => {
    expect(createStudioStorage("C:\\uploads", {})).toBeInstanceOf(
      FileStudioStorage,
    );
  });

  it("creates an R2 adapter only with complete credentials", () => {
    expect(
      createStudioStorage("C:\\uploads", {
        ASSET_STORAGE_PROVIDER: "r2",
        R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        R2_ACCESS_KEY_ID: "access",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET: "sweettoon-assets",
        R2_PRIVATE_BUCKET: "sweettoon-originals",
        R2_PUBLIC_BASE_URL: "https://assets.example.com",
      }),
    ).toBeInstanceOf(R2StudioStorage);
  });

  it("fails closed when an R2 setting is missing", () => {
    expect(() =>
      createStudioStorage("C:\\uploads", {
        ASSET_STORAGE_PROVIDER: "r2",
      }),
    ).toThrow("R2_ENDPOINT");
  });

  it("rejects unknown providers", () => {
    expect(() =>
      createStudioStorage("C:\\uploads", {
        ASSET_STORAGE_PROVIDER: "minio",
      }),
    ).toThrow("Unsupported ASSET_STORAGE_PROVIDER");
  });
});
