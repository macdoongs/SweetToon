import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import type { Store } from "express-rate-limit";

export type SharedRateLimitStore = {
  store?: Store;
  close(): Promise<void>;
};

export async function createSharedRateLimitStore(
  redisUrl: string | undefined,
): Promise<SharedRateLimitStore> {
  if (!redisUrl) {
    return { close: async () => undefined };
  }

  const client = createClient({ url: redisUrl });
  client.on("error", (error) => {
    console.error("[sweettoon-redis]", error);
  });
  await client.connect();

  return {
    store: new RedisStore({
      prefix: "sweettoon:upload:",
      sendCommand: (...args: string[]) => client.sendCommand(args),
    }),
    async close() {
      if (client.isOpen) await client.close();
    },
  };
}
