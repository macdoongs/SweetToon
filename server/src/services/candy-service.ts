import type {
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
        "캔디가 부족합니다. 1권 소장본을 주문하면 캔디 5개를 받을 수 있어요.",
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
