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
  coverUrl: "/api/images/moonlight-laundry/cover.webp",
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
    listRealtimeSeriesKeys: jest
      .fn()
      .mockResolvedValue([{ slug: summary.slug, title: summary.title }]),
    listRealtimeSeries: jest.fn().mockResolvedValue([summary]),
    seriesExists: jest.fn().mockResolvedValue(true),
    findSeriesBySlug: jest.fn().mockResolvedValue(detail),
    findEpisodeById: jest.fn().mockResolvedValue(null),
    listSitemapDiscovery: jest
      .fn()
      .mockResolvedValue({ series: [], episodes: [] }),
    listRecentEpisodes: jest.fn().mockResolvedValue([]),
  };
  const orderService: jest.Mocked<DemoOrderUseCases> = {
    quote: jest.fn(),
    create: jest.fn(),
    createDemo: jest.fn().mockResolvedValue(demoOrder),
    get: jest.fn(),
    list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    findActiveDemo: jest.fn().mockResolvedValue(null),
    transition: jest.fn(),
    pruneCompletedDemos: jest.fn().mockResolvedValue(undefined),
    clearDemos: jest.fn().mockResolvedValue(undefined),
  };
  const realtime: jest.Mocked<RealtimeService> = {
    checkHealth: jest.fn().mockResolvedValue(undefined),
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
    expect(realtime.heartbeatSeries).toHaveBeenCalledWith(
      summary.slug,
      expect.any(String),
    );
    expect(orderService.createDemo).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonId: detail.seasons[0].id,
        ordererName: "실시간 데모 봇",
      }),
    );
    expect(realtime.publishOrder).toHaveBeenCalledWith(demoOrder);

    await bot.close();
  });

  it("only assigns virtual readers to series that have a thumbnail", async () => {
    const { readerRepository, orderService, realtime } = dependencies();
    readerRepository.listRealtimeSeriesKeys.mockResolvedValue([
      { slug: summary.slug, title: summary.title },
    ]);
    const bot = new DemoBotService(
      readerRepository,
      orderService,
      realtime,
      { available: true, autoStart: false, readerCount: 2, speed: "slow" },
    );

    await bot.update({ running: true });

    expect(realtime.heartbeatSeries).toHaveBeenCalled();
    expect(
      realtime.heartbeatSeries.mock.calls.map(([slug]) => slug),
    ).toEqual(expect.not.arrayContaining(["without-cover"]));
    expect(
      realtime.heartbeatSeries.mock.calls.map(([slug]) => slug),
    ).toEqual(expect.arrayContaining([summary.slug]));
    await bot.close();
  });

  it("rotates completed series and volume numbers between demo purchases", async () => {
    const { readerRepository, orderService, realtime } = dependencies();
    const secondSummary = {
      ...summary,
      id: "series-2",
      slug: "corner-store",
      title: "골목 끝 편의점",
    };
    const secondDetail: SeriesDetail = {
      ...detail,
      id: secondSummary.id,
      slug: secondSummary.slug,
      title: secondSummary.title,
      seasons: [
        {
          ...detail.seasons[0],
          id: "cmseason00000000000000002",
          episodes: [
            { ...detail.seasons[0].episodes[0], id: "episode-2", volumeNumber: 1 },
            { ...detail.seasons[0].episodes[0], id: "episode-3", number: 6, volumeNumber: 2 },
          ],
        },
      ],
    };
    readerRepository.listRealtimeSeriesKeys.mockResolvedValue([
      { slug: summary.slug, title: summary.title },
      { slug: secondSummary.slug, title: secondSummary.title },
    ]);
    readerRepository.findSeriesBySlug.mockImplementation(async (slug) =>
      slug === secondSummary.slug ? secondDetail : detail,
    );
    orderService.findActiveDemo
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: demoOrder.id,
        isDemo: true,
        status: "pending",
      })
      .mockResolvedValueOnce({
        id: demoOrder.id,
        isDemo: true,
        status: "processing",
      })
      .mockResolvedValueOnce({
        id: demoOrder.id,
        isDemo: true,
        status: "shipped",
      })
      .mockResolvedValueOnce(null);
    orderService.transition.mockImplementation(async (_id, input) => ({
      ...demoOrder,
      status: input.status,
    }));
    const bot = new DemoBotService(
      readerRepository,
      orderService,
      realtime,
      { available: true, autoStart: false, readerCount: 2, speed: "fast" },
    );

    await bot.update({ running: true });
    for (let tick = 1; tick < 15; tick += 1) {
      await bot.update({ readerCount: 2 });
    }

    expect(orderService.createDemo).toHaveBeenCalledTimes(2);
    expect(orderService.createDemo.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        seasonId: detail.seasons[0].id,
        volumeNumber: 1,
      }),
    );
    expect(orderService.createDemo.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        seasonId: secondDetail.seasons[0].id,
        volumeNumber: 2,
      }),
    );
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
