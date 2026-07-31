"use client";

import Link from "next/link";
import type { EpisodeReader } from "@/lib/reader-types";

// 잠긴 회차의 결제 선택지(캔디 해금·소장본 주문)를 보여주는 페이월.
export function ReaderPaywall({
  candyBalance,
  candyBusy,
  candyMessage,
  episode,
  onUnlockWithCandy,
  orderHref,
}: {
  candyBalance: number | null;
  candyBusy: boolean;
  candyMessage: string | null;
  episode: EpisodeReader;
  onUnlockWithCandy: () => void;
  orderHref: string;
}) {
  return (
    <section className="reader-paywall">
      <span aria-hidden="true">🔒</span>
      <p className="eyebrow">무료 미리보기 종료</p>
      <h2>
        {episode.access.freeVolumeCount > 0
          ? episode.access.previewEpisodeCount > 0
            ? `${episode.access.freeVolumeCount}권과 다음 ${episode.access.previewEpisodeCount}화`
            : `첫 ${episode.access.freeVolumeCount}권(${episode.access.freeVolumeCount * 5}화)`
          : `첫 ${episode.access.previewEpisodeCount}화`}
        까지 무료로 읽을 수 있어요.
      </h2>
      <p>
        이 회차는 시즌 {episode.season.number} ·{" "}
        {episode.access.volumeNumber}권에 수록됩니다. 캔디 1개로 이 회차를
        지금 쓰는 브라우저에서 계속 읽거나, 소장본을 주문해 수록된 다섯
        화를 함께 열 수 있습니다.
      </p>
      <div className="reader-paywall__candy">
        <div>
          <strong>🍬 캔디 {candyBalance ?? "—"}개</strong>
          <span>1개 = 100원 · 유료 회차 1편</span>
        </div>
        <button
          className="button button--primary"
          disabled={candyBusy || candyBalance === 0}
          onClick={onUnlockWithCandy}
          type="button"
        >
          {candyBusy ? "회차 여는 중…" : "캔디 1개로 이 화 보기"}
        </button>
      </div>
      {candyBalance === 0 ? (
        <Link
          className="button button--light"
          href={`/candy?returnTo=${encodeURIComponent(`/read/${episode.id}`)}`}
        >
          캔디 충전하고 돌아오기
        </Link>
      ) : null}
      {candyMessage ? (
        <p className="reader-paywall__message" role="status">
          {candyMessage}
        </p>
      ) : null}
      <Link className="button button--primary" href={orderHref}>
        {episode.access.volumeNumber === 1
          ? "1권 소장하고 캔디 5개 받기"
          : `${episode.access.volumeNumber}권 소장하고 다섯 화 열기`}
      </Link>
      <Link
        className="reader-finish__back"
        href={`/series/${encodeURIComponent(episode.series.slug)}#episodes`}
      >
        무료 회차 목록으로
      </Link>
    </section>
  );
}
