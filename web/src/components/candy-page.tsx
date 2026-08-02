"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, isUncertainRequestError, postJson } from "@/lib/api";
import {
  getCandyWalletToken,
  notifyCandyUpdated,
  type CandyChargeAmount,
  type CandyChargeResponse,
  type CandyWallet,
} from "@/lib/candy-wallet";

const packages: CandyChargeAmount[] = [10, 30, 50];

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function CandyPage({
  returnTo = null,
}: {
  returnTo?: string | null;
}) {
  const [chargedOnce, setChargedOnce] = useState(false);
  const chargeRequest = useRef<{
    candyAmount: CandyChargeAmount;
    requestKey: string;
  } | null>(null);
  const [wallet, setWallet] = useState<CandyWallet | null>(null);
  const [walletState, setWalletState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [charging, setCharging] = useState<CandyChargeAmount | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setWalletState("loading");
    setError(null);
    try {
      const token = getCandyWalletToken();
      setWallet(await getJson<CandyWallet>(
        `/api/candy-wallets/${encodeURIComponent(token)}`,
      ));
      setWalletState("ready");
    } catch (reason) {
      setWalletState("error");
      setError(
        reason instanceof Error
          ? reason.message
          : "캔디 지갑을 불러오지 못했습니다.",
      );
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  async function charge(candyAmount: CandyChargeAmount) {
    setCharging(candyAmount);
    setMessage(null);
    setError(null);
    try {
      const token = getCandyWalletToken();
      if (chargeRequest.current?.candyAmount !== candyAmount) {
        chargeRequest.current = {
          candyAmount,
          requestKey: crypto.randomUUID(),
        };
      }
      const result = await postJson<
        { requestKey: string; candyAmount: CandyChargeAmount },
        CandyChargeResponse
      >(`/api/candy-wallets/${encodeURIComponent(token)}/charges`, {
        requestKey: chargeRequest.current.requestKey,
        candyAmount,
      });
      chargeRequest.current = null;
      setWallet(result);
      setWalletState("ready");
      notifyCandyUpdated();
      setChargedOnce(true);
      setMessage(
        `데모 캔디 ${result.chargedCandy}개를 충전했습니다. 현재 ${result.balance}개예요.`,
      );
    } catch (reason) {
      if (!isUncertainRequestError(reason)) {
        chargeRequest.current = null;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "캔디를 충전하지 못했습니다.",
      );
    } finally {
      setCharging(null);
    }
  }

  return (
    <main className="candy-page">
      <header className="candy-hero">
        <div>
          <p className="eyebrow">SweetToon Candy</p>
          <h1>캔디 충전</h1>
          <p>
            캔디 1개로 유료 회차 1편을 열 수 있어요. 캔디는 1개당
            100원으로 계산됩니다.
          </p>
        </div>
        <div className="candy-balance" aria-live="polite">
          <span>보유 캔디</span>
          <strong>
            🍬 {walletState === "loading" ? "확인 중…" : wallet?.balance ?? "—"}
          </strong>
        </div>
      </header>

      <section className="candy-demo-notice">
        <strong>결제 없는 Mock 충전</strong>
        <p>
          과제용 데모입니다. 카드나 계좌 정보를 받지 않고 실제 금액도
          청구하지 않습니다.
        </p>
      </section>

      <section aria-labelledby="candy-packages-title">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Packages</p>
            <h2 id="candy-packages-title">충전할 캔디를 골라주세요</h2>
          </div>
          <p>모든 패키지의 단가는 동일해요.</p>
        </div>
        <div className="candy-packages">
          {packages.map((amount) => (
            <article className="candy-package" key={amount}>
              <span aria-hidden="true">🍬</span>
              <strong>{amount}개</strong>
              <p>{formatWon(amount * 100)}</p>
              <small>유료 회차 {amount}편</small>
              <button
                className="button button--primary"
                disabled={charging !== null || walletState === "loading"}
                onClick={() => void charge(amount)}
                type="button"
              >
                {charging === amount ? "충전 중…" : "데모로 충전"}
              </button>
            </article>
          ))}
        </div>
      </section>
      {message ? (
        <p className="candy-page__message" role="status">
          {message}
        </p>
      ) : null}
      {returnTo && chargedOnce ? (
        <p className="candy-page__return">
          <Link className="button button--primary" href={returnTo}>
            읽던 회차로 돌아가기 →
          </Link>
        </p>
      ) : null}
      {error ? (
        <div className="candy-page__error" role="alert">
          <p>{error}</p>
          {walletState === "error" ? (
            <button
              className="button button--ghost"
              onClick={() => void refresh()}
              type="button"
            >
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="candy-page__footnote">
        1권 소장본(1~5화)을 주문하면 별도로 캔디 5개가 지급됩니다.
      </p>
    </main>
  );
}
