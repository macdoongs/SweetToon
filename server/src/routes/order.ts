import { Router, type RequestHandler } from "express";
import {
  CreateOrderRequestSchema,
  OrderDetailSchema,
  OrderIdParamSchema,
  OrderListQuerySchema,
  OrderListResponseSchema,
  OrderReceiptSchema,
  OrderTransitionRequestSchema,
  PrintQuoteRequestSchema,
  PrintQuoteResponseSchema,
} from "../contracts/order";
import { fieldIssueMessage } from "../contracts/validation";
import type { OrderUseCases } from "../services/order-service";
import {
  NoopSecurityAuditLogger,
  auditSecurityAction,
  type SecurityAuditLogger,
} from "../security/audit-logger";
import type { RealtimeService } from "../realtime/realtime-service";

type OrderRouterOptions = {
  operationsGuard?: RequestHandler;
  auditLogger?: SecurityAuditLogger;
  realtime?: RealtimeService;
};

const allowRequest: RequestHandler = (_req, _res, next) => next();

const orderFieldLabels = {
  bookSize: "판형",
  coverType: "표지",
  quantity: "수량",
  ordererName: "주문자 닉네임",
  memo: "메모",
};

export function createOrderRouter(
  service: OrderUseCases,
  {
    operationsGuard = allowRequest,
    auditLogger = new NoopSecurityAuditLogger(),
    realtime,
  }: OrderRouterOptions = {},
): Router {
  const router = Router();

  router.post("/print-quotes", async (req, res) => {
    const input = PrintQuoteRequestSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({
        code: "INVALID_PRINT_SPECIFICATION",
        message: fieldIssueMessage(
          input.error,
          orderFieldLabels,
          "판형, 표지와 수량을 다시 확인해 주세요.",
        ),
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
        message: fieldIssueMessage(
          input.error,
          orderFieldLabels,
          "주문자와 소장본 정보를 다시 확인해 주세요.",
        ),
      });
      return;
    }
    res.status(201).json(OrderReceiptSchema.parse(await service.create(input.data)));
  });

  router.get("/orders", async (req, res) => {
    const query = OrderListQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        code: "INVALID_ORDER_LIST_QUERY",
        message: "주문 목록 조회 조건을 다시 확인해 주세요.",
      });
      return;
    }
    res.json(OrderListResponseSchema.parse(await service.list(query.data)));
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

  router.get("/orders/:id/events", async (req, res) => {
    const id = OrderIdParamSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({
        code: "INVALID_ORDER_ID",
        message: "주문 주소가 올바르지 않습니다.",
      });
      return;
    }

    let closed = false;
    let keepAlive: NodeJS.Timeout | null = null;
    let unsubscribe: (() => Promise<void>) | null = null;
    const releaseSubscription = async () => {
      if (!unsubscribe) return;
      const release = unsubscribe;
      unsubscribe = null;
      await release();
    };
    req.once("close", () => {
      closed = true;
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
      void releaseSubscription().catch((error) => {
        console.error("[sweettoon-order-stream-cleanup]", error);
      });
    });

    const initialOrder = OrderDetailSchema.parse(await service.get(id.data));
    if (closed) return;

    res.status(200);
    res.set({
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const send = (order: typeof initialOrder) => {
      res.write(`id: ${order.updatedAt}\n`);
      res.write("event: order\n");
      res.write(`data: ${JSON.stringify(order)}\n\n`);
    };
    send(initialOrder);

    try {
      unsubscribe = realtime
        ? await realtime.subscribeOrder(id.data, send)
        : async () => undefined;
      if (closed) {
        await releaseSubscription();
        return;
      }
    } catch (error) {
      console.error("[sweettoon-order-stream]", error);
      res.end();
      return;
    }
    keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 15_000);
  });

  router.patch(
    "/orders/:id/status",
    auditSecurityAction(auditLogger, "operations.order.transition"),
    operationsGuard,
    async (req, res) => {
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
      const order = OrderDetailSchema.parse(
        await service.transition(id.data, input.data),
      );
      try {
        await realtime?.publishOrder(order);
      } catch (error) {
        // The committed database transition remains authoritative. A failed
        // live notification must not make the operator repeat the mutation.
        console.error("[sweettoon-order-publish]", error);
      }
      res.json(order);
    },
  );

  return router;
}
