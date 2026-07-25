import { randomUUID } from "node:crypto";
import type {
  DemoBotSpeed,
  DemoBotStatus,
  DemoBotUpdate,
} from "../contracts/demo-bot";
import type { OrderStatus } from "../contracts/order";
import type { ReaderRepository } from "../repositories/reader-repository";
import type { DemoOrderUseCases } from "../services/order-service";
import type { RealtimeService } from "./realtime-service";

const SPEED_INTERVAL_MS: Record<DemoBotSpeed, number> = {
  slow: 15_000,
  normal: 8_000,
  fast: 3_000,
};
const ORDER_EVERY_TICKS = 3;
const DEMO_WALLET_TOKEN = "00000000-0000-4000-8000-000000000001";
const LEASE_NAME = "realtime-demo-bot";

const nextOrderStatus: Partial<
  Record<OrderStatus, "processing" | "shipped" | "completed">
> = {
  pending: "processing",
  processing: "shipped",
  shipped: "completed",
};

export class DemoBotUnavailableError extends Error {
  readonly code = "DEMO_BOT_DISABLED";
  readonly status = 409;

  constructor() {
    super("실시간 데모 봇이 이 환경에서는 비활성화되어 있습니다.");
    this.name = "DemoBotUnavailableError";
  }
}

export interface DemoBotController {
  status(): DemoBotStatus;
  update(input: DemoBotUpdate): Promise<DemoBotStatus>;
  reset(): Promise<DemoBotStatus>;
  start(): void;
  close(): Promise<void>;
}

type DemoBotServiceOptions = {
  available: boolean;
  autoStart?: boolean;
  readerCount?: number;
  speed?: DemoBotSpeed;
  now?: () => number;
};

export class DemoBotService implements DemoBotController {
  private readonly ownerId = randomUUID();
  private readonly bots = new Map<string, string>();
  private readonly now: () => number;
  private available: boolean;
  private running: boolean;
  private leader = false;
  private readerCount: number;
  private speed: DemoBotSpeed;
  private timer: NodeJS.Timeout | null = null;
  private tickNumber = 0;
  private seriesCursor = 0;
  private ticking = false;
  private lastTickAt: string | null = null;
  private nextTickAt: string | null = null;
  private activeOrderId: string | null = null;
  private lastAction: string | null = null;

  constructor(
    private readonly readerRepository: ReaderRepository,
    private readonly orderService: DemoOrderUseCases,
    private readonly realtime: RealtimeService,
    options: DemoBotServiceOptions,
  ) {
    this.available = options.available;
    this.running = options.available && (options.autoStart ?? true);
    this.readerCount = options.readerCount ?? 8;
    this.speed = options.speed ?? "normal";
    this.now = options.now ?? Date.now;
  }

  status(): DemoBotStatus {
    return {
      available: this.available,
      running: this.running,
      leader: this.leader,
      readerCount: this.readerCount,
      activeBotCount: this.bots.size,
      speed: this.speed,
      tickIntervalSeconds: SPEED_INTERVAL_MS[this.speed] / 1_000,
      lastTickAt: this.lastTickAt,
      nextTickAt: this.nextTickAt,
      activeOrderId: this.activeOrderId,
      lastAction: this.lastAction,
    };
  }

  start(): void {
    if (!this.running || this.timer) return;
    void this.tick();
    this.schedule();
  }

  async update(input: DemoBotUpdate): Promise<DemoBotStatus> {
    this.requireAvailable();
    if (input.readerCount !== undefined) this.readerCount = input.readerCount;
    if (input.speed !== undefined) this.speed = input.speed;
    if (input.running !== undefined) this.running = input.running;

    if (!this.running) {
      this.clearTimer();
      await this.clearPresence();
      this.leader = false;
      await this.realtime.releaseLease(LEASE_NAME, this.ownerId);
    } else {
      this.clearTimer();
      await this.tick();
      this.schedule();
    }
    return this.status();
  }

  async reset(): Promise<DemoBotStatus> {
    this.requireAvailable();
    await this.clearPresence();
    await this.orderService.clearDemos();
    this.tickNumber = 0;
    this.seriesCursor = 0;
    this.activeOrderId = null;
    this.lastAction = "데모 독자와 주문을 초기화했습니다.";
    if (this.running) await this.tick();
    return this.status();
  }

  async close(): Promise<void> {
    this.running = false;
    this.clearTimer();
    await this.clearPresence();
    await this.realtime.releaseLease(LEASE_NAME, this.ownerId);
  }

  private schedule(): void {
    if (!this.running) return;
    const interval = SPEED_INTERVAL_MS[this.speed];
    this.nextTickAt = new Date(this.now() + interval).toISOString();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick().finally(() => this.schedule());
    }, interval);
  }

  private async tick(): Promise<void> {
    if (!this.running || this.ticking) return;
    this.ticking = true;
    try {
      const intervalSeconds = Math.ceil(
        SPEED_INTERVAL_MS[this.speed] / 1_000,
      );
      this.leader = await this.realtime.claimLease(
        LEASE_NAME,
        this.ownerId,
        Math.max(10, intervalSeconds * 3),
      );
      if (!this.leader) {
        this.lastAction = "다른 서버의 데모 봇이 실행 중입니다.";
        return;
      }
      const slugs = await this.loadSeriesSlugs();
      await this.tickReaders(slugs);
      this.tickNumber += 1;
      if (this.tickNumber % ORDER_EVERY_TICKS === 0) {
        await this.tickOrder(slugs);
      }
      this.lastTickAt = new Date(this.now()).toISOString();
    } catch (error) {
      this.lastAction = "데모 봇 갱신 중 오류가 발생했습니다.";
      console.error("[sweettoon-demo-bot]", error);
    } finally {
      this.ticking = false;
    }
  }

  private async loadSeriesSlugs(): Promise<string[]> {
    const first = await this.readerRepository.listSeries({
      filter: "all",
      page: 1,
      pageSize: 24,
    });
    const second = first.nextPage
      ? await this.readerRepository.listSeries({
          filter: "all",
          page: first.nextPage,
          pageSize: 24,
        })
      : null;
    return [...first.items, ...(second?.items ?? [])]
      .filter((item) => Boolean(item.coverUrl))
      .map((item) => item.slug);
  }

  private async tickReaders(slugs: string[]): Promise<void> {
    if (slugs.length === 0) return;
    const wave = [-1, 0, 1, 0][this.tickNumber % 4] ?? 0;
    const desired = Math.max(
      0,
      Math.min(30, this.readerCount + (this.readerCount > 0 ? wave : 0)),
    );
    while (this.bots.size < desired) {
      const sessionId = randomUUID();
      const slug = slugs[this.seriesCursor % slugs.length];
      this.seriesCursor += 1;
      this.bots.set(sessionId, slug);
    }
    if (this.bots.size > desired) {
      const removed = [...this.bots.keys()].slice(desired);
      await this.realtime.removePresence(removed);
      removed.forEach((sessionId) => this.bots.delete(sessionId));
    }
    const firstBot = this.bots.keys().next().value as string | undefined;
    if (firstBot && this.tickNumber > 0) {
      const nextSlug = slugs[this.seriesCursor % slugs.length];
      this.seriesCursor += 1;
      this.bots.set(firstBot, nextSlug);
    }
    await Promise.all(
      [...this.bots].map(([sessionId, slug]) =>
        this.realtime.heartbeatSeries(slug, sessionId),
      ),
    );
    this.lastAction = `가상 독자 ${this.bots.size}명의 읽기 상태를 갱신했습니다.`;
  }

  private async tickOrder(slugs: string[]): Promise<void> {
    const { items } = await this.orderService.list();
    const active = items.find(
      (order) =>
        order.isDemo &&
        order.status !== "completed" &&
        order.status !== "canceled",
    );
    if (active) {
      const status = nextOrderStatus[active.status];
      if (!status) return;
      const updated = await this.orderService.transition(active.id, { status });
      await this.realtime.publishOrder(updated);
      this.activeOrderId =
        updated.status === "completed" ? null : updated.id;
      this.lastAction = `데모 주문을 ${updated.status} 상태로 변경했습니다.`;
      await this.orderService.pruneCompletedDemos(5);
      return;
    }

    for (const slug of slugs) {
      const series = await this.readerRepository.findSeriesBySlug(slug);
      const season = series?.seasons.find(
        (item) => item.status === "completed" && item.episodes.length > 0,
      );
      if (!season) continue;
      const created = await this.orderService.createDemo({
        requestKey: randomUUID(),
        candyWalletToken: DEMO_WALLET_TOKEN,
        seasonId: season.id,
        volumeNumber: 1,
        bookSize: "A5",
        coverType: "softcover",
        quantity: 1,
        ordererName: "실시간 데모 봇",
        memo: "자동 실시간 시연 주문",
      });
      await this.realtime.publishOrder(created);
      this.activeOrderId = created.id;
      this.lastAction = `새 데모 주문 ${created.id}을 생성했습니다.`;
      await this.orderService.pruneCompletedDemos(5);
      return;
    }
  }

  private async clearPresence(): Promise<void> {
    const sessionIds = [...this.bots.keys()];
    this.bots.clear();
    if (sessionIds.length > 0) {
      await this.realtime.removePresence(sessionIds);
    }
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.nextTickAt = null;
  }

  private requireAvailable(): void {
    if (!this.available) throw new DemoBotUnavailableError();
  }
}
