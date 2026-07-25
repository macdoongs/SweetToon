import type {
  CandyChargeRequest,
  CandyChargeResponse,
  CandyUnlockRequest,
  CandyUnlockResponse,
  CandyWallet,
} from "../contracts/candy";
import type { CandyRepository } from "../repositories/candy-repository";

export class CandyServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CandyServiceError";
  }
}

export interface CandyUseCases {
  getWallet(walletToken: string): Promise<CandyWallet>;
  charge(
    walletToken: string,
    input: CandyChargeRequest,
  ): Promise<CandyChargeResponse>;
  unlockEpisode(
    episodeId: string,
    input: CandyUnlockRequest,
  ): Promise<CandyUnlockResponse>;
}

export class CandyService implements CandyUseCases {
  constructor(private readonly repository: CandyRepository) {}

  async getWallet(walletToken: string): Promise<CandyWallet> {
    return {
      balance: await this.repository.getBalance(walletToken),
      unitPrice: 100,
    };
  }

  async charge(
    walletToken: string,
    input: CandyChargeRequest,
  ): Promise<CandyChargeResponse> {
    const result = await this.repository.charge(
      walletToken,
      input.candyAmount,
      input.requestKey,
    );
    if (result.kind === "request_conflict") {
      throw new CandyServiceError(
        "CANDY_CHARGE_REQUEST_CONFLICT",
        "이미 다른 충전에 사용된 요청입니다.",
        409,
      );
    }
    return {
      balance: result.balance,
      unitPrice: 100,
      chargedCandy: input.candyAmount,
      price: input.candyAmount * 100,
      currency: "KRW",
      mock: true,
      charged: result.kind === "charged",
    };
  }

  async unlockEpisode(
    episodeId: string,
    input: CandyUnlockRequest,
  ): Promise<CandyUnlockResponse> {
    const result = await this.repository.unlockEpisode(
      input.walletToken,
      episodeId,
      input.requestKey,
    );
    if (result.kind === "not_found") {
      throw new CandyServiceError(
        "EPISODE_NOT_FOUND",
        "요청한 에피소드를 찾을 수 없습니다.",
        404,
      );
    }
    if (result.kind === "insufficient") {
      throw new CandyServiceError(
        "INSUFFICIENT_CANDY",
        "캔디가 부족합니다. 데모 충전하거나 1권 소장본을 주문해 캔디 5개를 받을 수 있어요.",
        409,
      );
    }
    return {
      balance: result.balance,
      unitPrice: 100,
      episodeId,
      spent: result.kind === "unlocked",
    };
  }
}
