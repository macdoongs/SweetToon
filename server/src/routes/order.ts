import { Router } from "express";
import {
  CreateOrderRequestSchema,
  OrderDetailSchema,
  OrderIdParamSchema,
  OrderListResponseSchema,
  OrderTransitionRequestSchema,
  PrintQuoteRequestSchema,
  PrintQuoteResponseSchema,
} from "../contracts/order";
import type { OrderUseCases } from "../services/order-service";

export function createOrderRouter(service: OrderUseCases): Router {
  const router = Router();

  router.post("/print-quotes", async (req, res) => {
    const input = PrintQuoteRequestSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({
        code: "INVALID_PRINT_SPECIFICATION",
        message: "판형, 표지와 수량을 다시 확인해 주세요.",
      });
      return;
    }
    res.json(PrintQuoteResponseSchema.parse(await service.quote(input.data)));
  });

  router.post("/orders", async (req, res) => {
    const input = CreateOrderRequestSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({
        code: "INVALID_ORDER",
        message: "주문자와 소장본 정보를 다시 확인해 주세요.",
      });
      return;
    }
    res.status(201).json(OrderDetailSchema.parse(await service.create(input.data)));
  });

  router.get("/orders", async (_req, res) => {
    res.json(OrderListResponseSchema.parse(await service.list()));
  });

  router.get("/orders/:id", async (req, res) => {
    const id = OrderIdParamSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({
        code: "INVALID_ORDER_ID",
        message: "주문 주소가 올바르지 않습니다.",
      });
      return;
    }
    res.json(OrderDetailSchema.parse(await service.get(id.data)));
  });

  router.patch("/orders/:id/status", async (req, res) => {
    const id = OrderIdParamSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({
        code: "INVALID_ORDER_ID",
        message: "주문 주소가 올바르지 않습니다.",
      });
      return;
    }
    const input = OrderTransitionRequestSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({
        code: "INVALID_ORDER_STATUS",
        message: "변경할 제작 상태를 다시 확인해 주세요.",
      });
      return;
    }
    res.json(
      OrderDetailSchema.parse(await service.transition(id.data, input.data)),
    );
  });

  return router;
}
