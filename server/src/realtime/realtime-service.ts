import { createClient, type RedisClientType } from "redis";
import type { OrderDetail } from "../contracts/order";

export const PRESENCE_TTL_SECONDS = 60;

type OrderListener = (order: OrderDetail) => void;

export interface RealtimeService {
  publishOrder(order: OrderDetail): Promise<void>;
  subscribeOrder(
    orderId: string,
    listener: OrderListener,
  ): Promise<() => Promise<void>>;
  heartbeatSeries(seriesSlug: string, sessionId: string): Promise<number>;
  getViewerCounts(seriesSlugs: string[]): Promise<Record<string, number>>;
  removePresence(sessionIds: string[]): Promise<void>;
  claimLease(name: string, ownerId: string, ttlSeconds: number): Promise<boolean>;
  releaseLease(name: string, ownerId: string): Promise<void>;
  close(): Promise<void>;
}

function orderChannel(orderId: string) {
  return `sweettoon:orders:${orderId}`;
}

function presenceKey(seriesSlug: string) {
  return `sweettoon:presence:${seriesSlug}`;
}

function presenceSessionKey(sessionId: string) {
  return `sweettoon:presence-session:${sessionId}`;
}

function leaseKey(name: string) {
  return `sweettoon:lease:${name}`;
}

export class InMemoryRealtimeService implements RealtimeService {
  private readonly listeners = new Map<string, Set<OrderListener>>();
  private readonly presence = new Map<string, Map<string, number>>();
  private readonly sessionSeries = new Map<string, string>();
  private readonly leases = new Map<
    string,
    { ownerId: string; expiresAt: number }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  async publishOrder(order: OrderDetail): Promise<void> {
    for (const listener of this.listeners.get(order.id) ?? []) {
      listener(order);
    }
  }

  async subscribeOrder(
    orderId: string,
    listener: OrderListener,
  ): Promise<() => Promise<void>> {
    const listeners = this.listeners.get(orderId) ?? new Set<OrderListener>();
    listeners.add(listener);
    this.listeners.set(orderId, listeners);
    return async () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(orderId);
    };
  }

  async heartbeatSeries(
    seriesSlug: string,
    sessionId: string,
  ): Promise<number> {
    const previousSeries = this.sessionSeries.get(sessionId);
    if (previousSeries && previousSeries !== seriesSlug) {
      this.presence.get(previousSeries)?.delete(sessionId);
    }
    const sessions = this.prune(seriesSlug);
    sessions.set(sessionId, this.now());
    this.presence.set(seriesSlug, sessions);
    this.sessionSeries.set(sessionId, seriesSlug);
    return sessions.size;
  }

  async getViewerCounts(
    seriesSlugs: string[],
  ): Promise<Record<string, number>> {
    return Object.fromEntries(
      seriesSlugs.map((slug) => [slug, this.prune(slug).size]),
    );
  }

  async removePresence(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      const seriesSlug = this.sessionSeries.get(sessionId);
      if (seriesSlug) this.presence.get(seriesSlug)?.delete(sessionId);
      this.sessionSeries.delete(sessionId);
    }
  }

  async claimLease(
    name: string,
    ownerId: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const existing = this.leases.get(name);
    if (
      existing &&
      existing.ownerId !== ownerId &&
      existing.expiresAt > this.now()
    ) {
      return false;
    }
    this.leases.set(name, {
      ownerId,
      expiresAt: this.now() + ttlSeconds * 1_000,
    });
    return true;
  }

  async releaseLease(name: string, ownerId: string): Promise<void> {
    if (this.leases.get(name)?.ownerId === ownerId) this.leases.delete(name);
  }

  async close(): Promise<void> {
    this.listeners.clear();
    this.presence.clear();
    this.sessionSeries.clear();
    this.leases.clear();
  }

  private prune(seriesSlug: string): Map<string, number> {
    const sessions = this.presence.get(seriesSlug) ?? new Map<string, number>();
    const cutoff = this.now() - PRESENCE_TTL_SECONDS * 1_000;
    for (const [sessionId, seenAt] of sessions) {
      if (seenAt <= cutoff) {
        sessions.delete(sessionId);
        if (this.sessionSeries.get(sessionId) === seriesSlug) {
          this.sessionSeries.delete(sessionId);
        }
      }
    }
    if (sessions.size === 0) this.presence.delete(seriesSlug);
    return sessions;
  }
}

export class RedisRealtimeService implements RealtimeService {
  private constructor(
    private readonly command: RedisClientType,
    private readonly subscriber: RedisClientType,
  ) {}

  static async connect(redisUrl: string): Promise<RedisRealtimeService> {
    const command = createClient({ url: redisUrl });
    const subscriber = command.duplicate();
    command.on("error", (error) => {
      console.error("[sweettoon-realtime-redis]", error);
    });
    subscriber.on("error", (error) => {
      console.error("[sweettoon-realtime-subscriber]", error);
    });
    await Promise.all([command.connect(), subscriber.connect()]);
    return new RedisRealtimeService(command, subscriber);
  }

  async publishOrder(order: OrderDetail): Promise<void> {
    await this.command.publish(orderChannel(order.id), JSON.stringify(order));
  }

  async subscribeOrder(
    orderId: string,
    listener: OrderListener,
  ): Promise<() => Promise<void>> {
    const channel = orderChannel(orderId);
    const redisListener = (message: string) => {
      try {
        listener(JSON.parse(message) as OrderDetail);
      } catch (error) {
        console.error("[sweettoon-realtime-message]", error);
      }
    };
    await this.subscriber.subscribe(channel, redisListener);
    return async () => {
      if (this.subscriber.isOpen) {
        await this.subscriber.unsubscribe(channel, redisListener);
      }
    };
  }

  async heartbeatSeries(
    seriesSlug: string,
    sessionId: string,
  ): Promise<number> {
    const key = presenceKey(seriesSlug);
    const sessionKey = presenceSessionKey(sessionId);
    const now = Date.now();
    const cutoff = now - PRESENCE_TTL_SECONDS * 1_000;
    const previousSeries = await this.command.get(sessionKey);
    const transaction = this.command.multi();
    if (previousSeries && previousSeries !== seriesSlug) {
      transaction.zRem(presenceKey(previousSeries), sessionId);
    }
    await transaction
      .zAdd(key, { score: now, value: sessionId })
      .zRemRangeByScore(key, 0, cutoff)
      .expire(key, PRESENCE_TTL_SECONDS * 2)
      .set(sessionKey, seriesSlug, { EX: PRESENCE_TTL_SECONDS * 2 })
      .exec();
    return this.command.zCard(key);
  }

  async getViewerCounts(
    seriesSlugs: string[],
  ): Promise<Record<string, number>> {
    const cutoff = Date.now() - PRESENCE_TTL_SECONDS * 1_000;
    const entries = await Promise.all(
      seriesSlugs.map(async (slug) => {
        const key = presenceKey(slug);
        await this.command.zRemRangeByScore(key, 0, cutoff);
        return [slug, await this.command.zCard(key)] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async removePresence(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      const sessionKey = presenceSessionKey(sessionId);
      const seriesSlug = await this.command.get(sessionKey);
      const transaction = this.command.multi().del(sessionKey);
      if (seriesSlug) transaction.zRem(presenceKey(seriesSlug), sessionId);
      await transaction.exec();
    }
  }

  async claimLease(
    name: string,
    ownerId: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.command.eval(
      `
        local current = redis.call("GET", KEYS[1])
        if not current or current == ARGV[1] then
          redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
          return 1
        end
        return 0
      `,
      {
        keys: [leaseKey(name)],
        arguments: [ownerId, String(ttlSeconds)],
      },
    );
    return Number(result) === 1;
  }

  async releaseLease(name: string, ownerId: string): Promise<void> {
    await this.command.eval(
      `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        end
        return 0
      `,
      { keys: [leaseKey(name)], arguments: [ownerId] },
    );
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.command.isOpen ? this.command.close() : Promise.resolve(),
      this.subscriber.isOpen ? this.subscriber.close() : Promise.resolve(),
    ]);
  }
}

export async function createRealtimeService(
  redisUrl: string | undefined,
): Promise<RealtimeService> {
  return redisUrl
    ? RedisRealtimeService.connect(redisUrl)
    : new InMemoryRealtimeService();
}
