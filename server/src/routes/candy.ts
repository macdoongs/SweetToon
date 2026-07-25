import { Router } from "express";
import {
  CandyChargeRequestSchema,
  CandyChargeResponseSchema,
  CandyUnlockRequestSchema,
  CandyUnlockResponseSchema,
  CandyWalletSchema,
  CandyWalletTokenSchema,
} from "../contracts/candy";
import { IdParamSchema } from "../contracts/reader";
import type { CandyUseCases } from "../services/candy-service";

export function createCandyRouter(service: CandyUseCases): Router {
  const router = Router();

  router.get("/candy-wallets/:token", async (req, res) => {
    const token = CandyWalletTokenSchema.safeParse(req.params.token);
    if (!token.success) {
      res.status(400).json({
        code: "INVALID_CANDY_WALLET",
        message: "캔디 지갑 정보가 올바르지 않습니다.",
      });
      return;
    }
    res.json(CandyWalletSchema.parse(await service.getWallet(token.data)));
  });

  router.post("/candy-wallets/:token/charges", async (req, res) => {
    const token = CandyWalletTokenSchema.safeParse(req.params.token);
    const input = CandyChargeRequestSchema.safeParse(req.body);
    if (!token.success || !input.success) {
      res.status(400).json({
        code: "INVALID_CANDY_CHARGE",
        message: "캔디 충전 요청이 올바르지 않습니다.",
      });
      return;
    }
    res.json(
      CandyChargeResponseSchema.parse(
        await service.charge(token.data, input.data),
      ),
    );
  });

  router.post("/episodes/:id/candy-unlock", async (req, res) => {
    const episodeId = IdParamSchema.safeParse(req.params.id);
    const input = CandyUnlockRequestSchema.safeParse(req.body);
    if (!episodeId.success || !input.success) {
      res.status(400).json({
        code: "INVALID_CANDY_UNLOCK",
        message: "캔디 사용 요청이 올바르지 않습니다.",
      });
      return;
    }
    res.json(
      CandyUnlockResponseSchema.parse(
        await service.unlockEpisode(episodeId.data, input.data),
      ),
    );
  });

  return router;
}
