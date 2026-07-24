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

function writeCoverSvg(relPath: string, title: string, hue: number) {
  const abs = path.join(UPLOAD_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},55%,60%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360},55%,40%)"/>
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#g)"/>
  <text x="300" y="430" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="bold" fill="white">${title}</text>
</svg>`;
  fs.writeFileSync(abs, svg, "utf-8");
  return `/api/images/${relPath.split(path.sep).join("/")}`;
}

type SeriesSpec = {
  slug: string;
  title: string;
  genre: string;
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
    synopsis: "회사 옥상 텃밭에서 시작된 점심시간 30분의 비밀 모임.",
    status: "ongoing",
    hue: 130,
    author: { name: "이수달", bio: "밤 산책과 빨래 개는 시간을 좋아합니다." },
    seasons: [{ number: 1, title: "파종", status: "ongoing", episodes: 4, pagesPerEp: 7 }],
  },
];

async function main() {
  // 컨테이너 재시작 시 사용자가 만든 주문과 콘텐츠를 보존한다.
  // 데모 데이터는 빈 DB에만 최초 1회 생성한다.
  const existingSeries = await prisma.series.count();
  if (existingSeries > 0) {
    console.log(`Seed 건너뜀: 작품 ${existingSeries}개가 이미 있습니다.`);
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

    const coverUrl = writeCoverSvg(path.join(spec.slug, "cover.svg"), spec.title, spec.hue);
    const series = await prisma.series.create({
      data: {
        slug: spec.slug,
        authorId,
        title: spec.title,
        genre: spec.genre,
        synopsis: spec.synopsis,
        status: spec.status,
        coverUrl,
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
            title: `${ep}화`,
            publishedAt: new Date(Date.now() - (seasonSpec.episodes - ep) * 7 * 86400_000),
          },
        });

        for (let pg = 1; pg <= seasonSpec.pagesPerEp; pg++) {
          const rel = path.join(spec.slug, `s${seasonSpec.number}`, `ep${String(ep).padStart(3, "0")}`, `${String(pg).padStart(3, "0")}.svg`);
          const imageUrl = writeCutSvg(rel, spec.title, `시즌${seasonSpec.number} · ${ep}화 · ${pg}컷`, spec.hue);
          await prisma.page.create({
            data: { episodeId: episode.id, order: pg, imageUrl },
          });
        }
      }
    }
  }

  // 샘플 주문 — 다양한 상태로 시드해 목록/타임라인 UI를 바로 확인 가능하게
  const laundry = await prisma.series.findFirstOrThrow({ where: { title: "달빛 세탁소" }, include: { seasons: true } });
  const store = await prisma.series.findFirstOrThrow({ where: { title: "골목 끝 편의점" }, include: { seasons: true } });
  const blade = await prisma.series.findFirstOrThrow({ where: { title: "네온 검객" }, include: { seasons: true } });

  const ordersSpec = [
    { series: laundry, ordererName: "김소장", ordererType: "reader", coverType: "hardcover", bookSize: "A5", quantity: 1, status: "completed", memo: "1시즌 정주행 기념 소장!" },
    { series: store, ordererName: "박야근", ordererType: "creator", coverType: "softcover", bookSize: "B6", quantity: 20, status: "processing", memo: "독립출판 마켓용 견본 포함" },
    { series: blade, ordererName: "홍독자", ordererType: "reader", coverType: "softcover", bookSize: "A5", quantity: 2, status: "shipped", memo: null },
    { series: laundry, ordererName: "최수집", ordererType: "reader", coverType: "hardcover", bookSize: "A5", quantity: 1, status: "pending", memo: "선물용 포장 가능한가요?" },
    { series: store, ordererName: "정단골", ordererType: "reader", coverType: "softcover", bookSize: "B6", quantity: 1, status: "canceled", memo: null },
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
  for (const spec of ordersSpec) {
    const season = spec.series.seasons[0];
    const order = await prisma.order.create({
      data: {
        seriesId: spec.series.id,
        seasonId: season.id,
        ordererName: spec.ordererName,
        ordererType: spec.ordererType,
        quantity: spec.quantity,
        coverType: spec.coverType,
        bookSize: spec.bookSize,
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
