import type { SeriesDetail, SeriesListResponse } from "../contracts/reader";
import type { OrderDetail } from "../contracts/order";
import type { ReaderRepository } from "../repositories/reader-repository";
import type { DemoOrderUseCases } from "../services/order-service";
import { DemoBotService } from "./demo-bot-service";
import type { RealtimeService } from "./realtime-service";

const summary: SeriesListResponse["items"][number] = {
  id: "series-1",
  slug: "moonlight-laundry",
  title: "달빛 세탁소",
  synopsis: "기억을 세탁하는 밤의 가게",
  genre: "힐링",
  weekday: "mon",
  freeVolumeCount: 1,
  previewEpisodeCount: 0,
  coverUrl: null,
  status: "completed",
  author: { name: "이수달" },
  episodeCount: 5,
  completedSeasonCount: 1,
  latestEpisode: null,
};

const detail: SeriesDetail = {
  id: summary.id,
  slug: summary.slug,
  title: summary.title,
  synopsis: summary.synopsis,
  genre: summary.genre,
  weekday: summary.weekday,
  freeVolumeCount: summary.freeVolumeCount,
  previewEpisodeCount: summary.previewEpisodeCount,
  coverUrl: summary.coverUrl,
  status: summary.status,
  author: { name: "이수달", bio: null, avatarUrl: null },
  seasons: [
    {
      id: "cmseason00000000000000001",
      number: 1,
      title: "첫 권",
      status: "completed",
      episodes: [
        {
          id: "episode-1",
          number: 1,
          title: "첫 화",
          publishedAt: "2026-07-25T00:00:00.000Z",
          volumeNumber: 1,
          access: "free",
        },
      ],
    },
  ],
};

const demoOrder: OrderDetail = {
  id: "cmorder000000000000000001",
  isDemo: true,
  providerOrderId: "mock-demo",
  candyBonus: 0,
  ordererType: "reader",
  volumeNumber: 1,
  quantity: 1,
  coverType: "softcover",
  bookSize: "A5",
  pageCount: 8,
  currency: "KRW",
  unitPrice: 4_900,
  totalPrice: 4_900,
  estimatedBusinessDays: 5,
  status: "processing",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  series: {
    id: summary.id,
    slug: summary.slug,
    title: summary.title,
    coverUrl: null,
  },
  season: { id: detail.seasons[0].id, number: 1, title: "첫 권" },
  events: [],
};

function dependencies() {
  const readerRepository: jest.Mocked<ReaderRepository> = {
    listSeries: jest.fn().mockResolvedValue({
      items: [summary],
      page: 1,
      nextPage: null,
      total: 1,
      facets: { genres: ["힐링"], weekdays: ["mon"] },
    }),
    findSeriesBySlug: jest.fn().mockResolvedValue(detail),
    findEpisodeById: jest.fn().mockResolvedValue(null),
  };
  const orderService: jest.Mocked<DemoOrderUseCases> = {
    quote: jest.fn(),
    create: jest.fn(),
    createDemo: jest.fn().mockResolvedValue(demoOrder),
    get: jest.fn(),
    list: jest.fn().mockResolvedValue({ items: [] }),
    transition: jest.fn(),
    pruneCompletedDemos: jest.fn().mockResolvedValue(undefined),
    clearDemos: jest.fn().mockResolvedValue(undefined),
  };
  const realtime: jest.Mocked<RealtimeService> = {
    publishOrder: jest.fn().mockResolvedValue(undefined),
    subscribeOrder: jest.fn(),
    heartbeatSeries: jest.fn().mockResolvedValue(1),
    getViewerCounts: jest.fn(),
    removePresence: jest.fn().mockResolvedValue(undefined),
    claimLease: jest.fn().mockResolvedValue(true),
    releaseLease: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  return { readerRepository, orderService, realtime };
}

describe("DemoBotService", () => {
  it("moves virtual readers and periodically creates an isolated demo order", async () => {
    const { readerRepository, orderService, realtime } = dependencies();
    const bot = new DemoBotService(
      readerRepository,
      orderService,
      realtime,
      { available: true, autoStart: false, readerCount: 4, speed: "slow" },
    );

    await bot.update({ running: true });
    await bot.update({ readerCount: 4 });
    const status = await bot.update({ readerCount: 4 });

    expect(status.running).toBe(true);
    expect(status.leader).toBe(true);
    expect(realtime.heartbeatSeries).toHaveBeenCalled();
    expect(orderService.createDemo).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonId: detail.seasons[0].id,
        ordererName: "실시간 데모 봇",
      }),
    );
    expect(realtime.publishOrder).toHaveBeenCalledWith(demoOrder);

    await bot.close();
  });

  it("clears only bot presence and demo orders when reset", async () => {
    const { readerRepository, orderService, realtime } = dependencies();
    const bot = new DemoBotService(
      readerRepository,
      orderService,
      realtime,
      { available: true, autoStart: false, readerCount: 4, speed: "slow" },
    );
    await bot.update({ running: true });

    const status = await bot.reset();

    expect(realtime.removePresence).toHaveBeenCalled();
    expect(orderService.clearDemos).toHaveBeenCalledTimes(1);
    expect(status.lastAction).toBeTruthy();
    await bot.close();
  });
});
