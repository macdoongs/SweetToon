import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

// 시드용 플레이스홀더 컷 이미지(SVG) 생성 — 추후 AI 생성 이미지로 교체 가능
function writeCutSvg(relPath: string, title: string, label: string, hue: number) {
  const abs = path.join(UPLOAD_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},45%,88%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},50%,72%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1200" fill="url(#g)"/>
  <rect x="40" y="40" width="720" height="1120" fill="none" stroke="hsl(${hue},30%,35%)" stroke-width="6"/>
  <text x="400" y="560" text-anchor="middle" font-family="sans-serif" font-size="44" fill="hsl(${hue},35%,25%)">${title}</text>
  <text x="400" y="640" text-anchor="middle" font-family="sans-serif" font-size="32" fill="hsl(${hue},30%,35%)">${label}</text>
</svg>`;
  fs.writeFileSync(abs, svg, "utf-8");
  return `/api/images/${relPath.split(path.sep).join("/")}`;
}

function writeCoverImage(relPath: string, assetName: string) {
  const abs = path.join(UPLOAD_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "prisma", "assets", "covers", assetName),
    abs,
  );
  return `/api/images/${relPath.split(path.sep).join("/")}`;
}

const SHOWCASE_PAGE_ASSETS = Array.from(
  { length: 8 },
  (_, index) => `${String(index + 1).padStart(3, "0")}.webp`,
);

function writeShowcasePages() {
  return SHOWCASE_PAGE_ASSETS.map((assetName) => {
    const relPath = path.join(
      "moonlight-laundry",
      "s1",
      "ep001",
      assetName,
    );
    const abs = path.join(UPLOAD_DIR, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.copyFileSync(
      path.join(
        process.cwd(),
        "prisma",
        "assets",
        "episodes",
        "moonlight-laundry",
        "s1e1",
        assetName,
      ),
      abs,
    );
    return `/api/images/${relPath.split(path.sep).join("/")}`;
  });
}

type SeriesSpec = {
  slug: string;
  title: string;
  genre: string;
  weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  synopsis: string;
  status: string;
  hue: number;
  author: { name: string; bio: string };
  seasons: { number: number; title: string; status: string; episodes: number; pagesPerEp: number }[];
};

const SERIES: SeriesSpec[] = [
  {
    slug: "moonlight-laundry",
    title: "달빛 세탁소",
    genre: "힐링 판타지",
    weekday: "mon",
    synopsis: "밤에만 문을 여는 세탁소. 얼룩진 기억을 맡기면 아침엔 조금 가벼워져 있다.",
    status: "ongoing",
    hue: 255,
    author: { name: "이수달", bio: "밤 산책과 빨래 개는 시간을 좋아합니다." },
    seasons: [
      { number: 1, title: "얼룩의 계절", status: "completed", episodes: 8, pagesPerEp: 8 },
      { number: 2, title: "새벽 배달", status: "ongoing", episodes: 3, pagesPerEp: 8 },
    ],
  },
  {
    slug: "corner-store",
    title: "골목 끝 편의점",
    genre: "일상",
    weekday: "wed",
    synopsis: "심야 알바생 눈에만 보이는 단골들의 사정. 오늘도 삼각김밥은 하나 남는다.",
    status: "completed",
    hue: 35,
    author: { name: "박야근", bio: "편의점 야간 알바 3년 차의 기록." },
    seasons: [
      { number: 1, title: "야간 근무 일지", status: "completed", episodes: 10, pagesPerEp: 6 },
    ],
  },
  {
    slug: "neon-blade",
    title: "네온 검객",
    genre: "액션",
    weekday: "fri",
    synopsis: "2077년 서울, 검 한 자루로 네온 뒷골목을 지키는 마지막 검객의 이야기.",
    status: "ongoing",
    hue: 315,
    author: { name: "강네온", bio: "사이버펑크와 사극을 동시에 좋아하면 이렇게 됩니다." },
    seasons: [
      { number: 1, title: "각성", status: "completed", episodes: 6, pagesPerEp: 10 },
      { number: 2, title: "추격", status: "ongoing", episodes: 2, pagesPerEp: 10 },
    ],
  },
  {
    slug: "rooftop-garden",
    title: "옥상 정원 클럽",
    genre: "로맨스",
    weekday: "sun",
    synopsis: "회사 옥상 텃밭에서 시작된 점심시간 30분의 비밀 모임.",
    status: "ongoing",
    hue: 130,
    author: { name: "이수달", bio: "밤 산책과 빨래 개는 시간을 좋아합니다." },
    seasons: [{ number: 1, title: "파종", status: "ongoing", episodes: 4, pagesPerEp: 7 }],
  },
];

const CATALOG_TITLES = [
  "비 오는 날의 우체국",
  "별을 줍는 아이",
  "퇴근 후 마법상점",
  "우리 동네 용사님",
  "여름의 레코드",
  "고양이 탐정 사무소",
  "새벽 두 시의 식탁",
  "유령과 룸메이트",
  "청춘 버스 701",
  "파란 신호등",
  "도서관의 마지막 책",
  "오늘도 맑음 연구소",
  "괴물 신입사원",
  "달리는 구름",
  "낮잠 행성",
  "오래된 카메라",
  "마지막 홈런",
  "심야 영화부",
  "마법사와 택배기사",
  "봄날의 체크메이트",
  "작은 행성 식당",
  "시간을 걷는 골목",
  "바다 끝 기차역",
  "소원을 수선합니다",
] as const;

const CATALOG_GENRES = [
  "판타지",
  "로맨스",
  "일상",
  "액션",
  "미스터리",
  "스포츠",
] as const;
const CATALOG_WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

const CATALOG_SERIES: SeriesSpec[] = CATALOG_TITLES.map((title, index) => ({
  slug: `catalog-${String(index + 1).padStart(2, "0")}`,
  title,
  genre: CATALOG_GENRES[index % CATALOG_GENRES.length],
  weekday: CATALOG_WEEKDAYS[index % CATALOG_WEEKDAYS.length],
  synopsis: `${title}에서 시작되는 다섯 번의 짧고 선명한 이야기.`,
  status: index % 3 === 0 ? "completed" : "ongoing",
  hue: (index * 37 + 20) % 360,
  author: {
    name: `데모작가 ${String((index % 8) + 1).padStart(2, "0")}`,
    bio: "SweetToon 탐색과 로딩 흐름을 보여주는 데모 창작자입니다.",
  },
  seasons: [
    {
      number: 1,
      title: "첫 번째 권",
      status: index % 3 === 0 ? "completed" : "ongoing",
      episodes: 5,
      pagesPerEp: 1,
    },
  ],
}));

async function seedCatalogSeries() {
  for (const spec of CATALOG_SERIES) {
    if (await prisma.series.findUnique({ where: { slug: spec.slug } })) {
      continue;
    }
    const author =
      (await prisma.author.findFirst({ where: { name: spec.author.name } })) ??
      (await prisma.author.create({ data: spec.author }));
    const series = await prisma.series.create({
      data: {
        slug: spec.slug,
        authorId: author.id,
        title: spec.title,
        genre: spec.genre,
        weekday: spec.weekday,
        synopsis: spec.synopsis,
        status: spec.status,
      },
    });
    const seasonSpec = spec.seasons[0];
    const season = await prisma.season.create({
      data: {
        seriesId: series.id,
        number: seasonSpec.number,
        title: seasonSpec.title,
        status: seasonSpec.status,
      },
    });
    for (let ep = 1; ep <= seasonSpec.episodes; ep++) {
      const episode = await prisma.episode.create({
        data: {
          seasonId: season.id,
          number: ep,
          title: `${ep}화`,
          publishedAt: new Date(Date.now() - (5 - ep + indexOfWeekday(spec.weekday)) * 86400_000),
        },
      });
      const rel = path.join(
        spec.slug,
        "s1",
        `ep${String(ep).padStart(3, "0")}`,
        "001.svg",
      );
      await prisma.page.create({
        data: {
          episodeId: episode.id,
          order: 1,
          imageUrl: writeCutSvg(
            rel,
            spec.title,
            `${ep}화 · 데모 컷`,
            spec.hue,
          ),
        },
      });
    }
  }
}

function indexOfWeekday(weekday: SeriesSpec["weekday"]) {
  return CATALOG_WEEKDAYS.indexOf(weekday);
}

async function main() {
  const coverUrls = new Map<string, string>(
    SERIES.map((spec) => [
      spec.slug,
      writeCoverImage(
        path.join(spec.slug, "cover.webp"),
        `${spec.slug}.webp`,
      ),
    ] as const),
  );
  const showcasePageUrls = writeShowcasePages();
  // 컨테이너 재시작 시 사용자가 만든 주문과 콘텐츠를 보존한다.
  // 데모 레코드는 빈 DB에만 만들고, 정적 데모 표지만 안전하게 갱신한다.
  const existingSeries = await prisma.series.count();
  if (existingSeries > 0) {
    for (const spec of SERIES) {
      await prisma.series.updateMany({
        where: { slug: spec.slug },
        data: {
          coverUrl: coverUrls.get(spec.slug),
          weekday: spec.weekday,
        },
      });
    }
    await seedCatalogSeries();
    const showcaseEpisode = await prisma.episode.findFirst({
      where: {
        number: 1,
        season: {
          number: 1,
          series: { slug: "moonlight-laundry" },
        },
      },
      include: { pages: { orderBy: { order: "asc" } } },
    });
    if (showcaseEpisode) {
      await prisma.episode.update({
        where: { id: showcaseEpisode.id },
        data: { title: "맡겨진 얼룩" },
      });
      for (const [index, page] of showcaseEpisode.pages.entries()) {
        const imageUrl = showcasePageUrls[index];
        if (imageUrl) {
          await prisma.page.update({
            where: { id: page.id },
            data: { imageUrl },
          });
        }
      }
    }
    console.log(
      `Seed 데이터 유지: 기존 작품 ${existingSeries}개, 표지와 대표 1화를 갱신했습니다.`,
    );
    return;
  }

  const authors = new Map<string, string>();

  for (const spec of SERIES) {
    let authorId = authors.get(spec.author.name);
    if (!authorId) {
      const author = await prisma.author.create({ data: spec.author });
      authorId = author.id;
      authors.set(spec.author.name, authorId);
    }

    const series = await prisma.series.create({
      data: {
        slug: spec.slug,
        authorId,
        title: spec.title,
        genre: spec.genre,
        weekday: spec.weekday,
        synopsis: spec.synopsis,
        status: spec.status,
        coverUrl: coverUrls.get(spec.slug),
      },
    });

    for (const seasonSpec of spec.seasons) {
      const season = await prisma.season.create({
        data: {
          seriesId: series.id,
          number: seasonSpec.number,
          title: seasonSpec.title,
          status: seasonSpec.status,
        },
      });

      for (let ep = 1; ep <= seasonSpec.episodes; ep++) {
        const episode = await prisma.episode.create({
          data: {
            seasonId: season.id,
            number: ep,
            title:
              spec.slug === "moonlight-laundry" &&
              seasonSpec.number === 1 &&
              ep === 1
                ? "맡겨진 얼룩"
                : `${ep}화`,
            publishedAt: new Date(Date.now() - (seasonSpec.episodes - ep) * 7 * 86400_000),
          },
        });

        for (let pg = 1; pg <= seasonSpec.pagesPerEp; pg++) {
          const isShowcasePage =
            spec.slug === "moonlight-laundry" &&
            seasonSpec.number === 1 &&
            ep === 1;
          const rel = path.join(
            spec.slug,
            `s${seasonSpec.number}`,
            `ep${String(ep).padStart(3, "0")}`,
            `${String(pg).padStart(3, "0")}.svg`,
          );
          const imageUrl = isShowcasePage
            ? showcasePageUrls[pg - 1]
            : writeCutSvg(
                rel,
                spec.title,
                `시즌${seasonSpec.number} · ${ep}화 · ${pg}컷`,
                spec.hue,
              );
          await prisma.page.create({
            data: { episodeId: episode.id, order: pg, imageUrl },
          });
        }
      }
    }
  }

  await seedCatalogSeries();

  // 샘플 주문 — 다양한 상태로 시드해 목록/타임라인 UI를 바로 확인 가능하게
  const laundry = await prisma.series.findFirstOrThrow({ where: { title: "달빛 세탁소" }, include: { seasons: true } });
  const store = await prisma.series.findFirstOrThrow({ where: { title: "골목 끝 편의점" }, include: { seasons: true } });
  const blade = await prisma.series.findFirstOrThrow({ where: { title: "네온 검객" }, include: { seasons: true } });

  const ordersSpec = [
    { series: laundry, ordererName: "김소장", ordererType: "reader", coverType: "hardcover", bookSize: "A5", quantity: 1, status: "completed", memo: "1시즌 정주행 기념 소장!" },
    { series: store, ordererName: "박야근", ordererType: "creator", coverType: "softcover", bookSize: "B5", quantity: 20, status: "processing", memo: "독립출판 마켓용 견본 포함" },
    { series: blade, ordererName: "홍독자", ordererType: "reader", coverType: "softcover", bookSize: "A5", quantity: 2, status: "shipped", memo: null },
    { series: laundry, ordererName: "최수집", ordererType: "reader", coverType: "hardcover", bookSize: "A5", quantity: 1, status: "pending", memo: "선물용 포장 가능한가요?" },
    { series: store, ordererName: "정단골", ordererType: "reader", coverType: "softcover", bookSize: "B5", quantity: 1, status: "canceled", memo: null },
  ];

  const STATUS_FLOW: Record<string, string[]> = {
    pending: ["pending"],
    processing: ["pending", "processing"],
    shipped: ["pending", "processing", "shipped"],
    completed: ["pending", "processing", "shipped", "completed"],
    canceled: ["pending", "canceled"],
  };
  const STATUS_MESSAGE: Record<string, string> = {
    pending: "주문이 접수되었어요.",
    processing: "책을 만들고 있어요.",
    shipped: "책이 출발했어요.",
    completed: "배송이 완료되었어요.",
    canceled: "주문이 취소되었어요.",
  };

  let dayOffset = 14;
  for (const [orderIndex, spec] of ordersSpec.entries()) {
    const season = spec.series.seasons[0];
    const episodes = await prisma.episode.findMany({
      where: { seasonId: season.id },
      select: { _count: { select: { pages: true } } },
    });
    const pageCount = episodes.reduce(
      (total, episode) => total + episode._count.pages,
      0,
    );
    const basePrice = spec.bookSize === "B5" ? 4_800 : 4_200;
    const coverPrice = spec.coverType === "hardcover" ? 3_500 : 0;
    const unitPrice = basePrice + coverPrice + pageCount * 35;
    const order = await prisma.order.create({
      data: {
        requestKey: `00000000-0000-4000-8000-${String(orderIndex + 1).padStart(12, "0")}`,
        providerOrderId: `mock_seed_${orderIndex + 1}`,
        seriesId: spec.series.id,
        seasonId: season.id,
        volumeNumber: 1,
        ordererName: spec.ordererName,
        ordererType: spec.ordererType,
        quantity: spec.quantity,
        coverType: spec.coverType,
        bookSize: spec.bookSize,
        pageCount,
        currency: "KRW",
        unitPrice,
        totalPrice: unitPrice * spec.quantity,
        estimatedBusinessDays: 5,
        memo: spec.memo,
        status: spec.status,
        createdAt: new Date(Date.now() - dayOffset * 86400_000),
      },
    });
    const flow = STATUS_FLOW[spec.status];
    for (let i = 0; i < flow.length; i++) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: flow[i],
          message: STATUS_MESSAGE[flow[i]],
          createdAt: new Date(Date.now() - (dayOffset - i) * 86400_000),
        },
      });
    }
    dayOffset -= 3;
  }

  const counts = {
    authors: await prisma.author.count(),
    series: await prisma.series.count(),
    episodes: await prisma.episode.count(),
    pages: await prisma.page.count(),
    orders: await prisma.order.count(),
  };
  console.log("Seed 완료:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
