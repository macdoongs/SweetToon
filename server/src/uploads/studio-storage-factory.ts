import { S3Client } from "@aws-sdk/client-s3";
import { FileStudioStorage, type StudioStorage } from "./upload-session-storage";
import { R2StudioStorage } from "./r2-studio-storage";

type StorageEnvironment = NodeJS.ProcessEnv;

function requireValue(
  environment: StorageEnvironment,
  key: string,
): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(
      `ASSET_STORAGE_PROVIDER=r2 requires the ${key} environment variable.`,
    );
  }
  return value;
}

export function createStudioStorage(
  uploadDir: string,
  environment: StorageEnvironment = process.env,
): StudioStorage {
  const provider = environment.ASSET_STORAGE_PROVIDER?.trim() || "filesystem";
  if (provider === "filesystem") {
    return new FileStudioStorage(uploadDir);
  }
  if (provider !== "r2") {
    throw new Error(
      `Unsupported ASSET_STORAGE_PROVIDER: ${provider}. Use filesystem or r2.`,
    );
  }

  const endpoint = requireValue(environment, "R2_ENDPOINT");
  const accessKeyId = requireValue(environment, "R2_ACCESS_KEY_ID");
  const secretAccessKey = requireValue(environment, "R2_SECRET_ACCESS_KEY");
  return new R2StudioStorage({
    client: new S3Client({
      endpoint,
      region: environment.R2_REGION?.trim() || "auto",
      forcePathStyle:
        environment.R2_FORCE_PATH_STYLE?.trim().toLowerCase() === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket: requireValue(environment, "R2_BUCKET"),
    privateBucket: requireValue(environment, "R2_PRIVATE_BUCKET"),
    publicBaseUrl: requireValue(environment, "R2_PUBLIC_BASE_URL"),
    stagingDir: uploadDir,
  });
}
