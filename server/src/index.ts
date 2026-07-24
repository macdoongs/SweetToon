import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { PrismaReaderRepository } from "./repositories/reader-repository";
import { PrismaOrderRepository } from "./repositories/order-repository";
import { createPrintProvider } from "./printing/mock-print-provider";
import { OrderService } from "./services/order-service";

const PORT = Number(process.env.PORT ?? 4000);
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "data", "uploads");

const prisma = new PrismaClient();
const printProvider = createPrintProvider();
const app = createApp({
  readerRepository: new PrismaReaderRepository(prisma),
  printProvider,
  orderService: new OrderService(
    new PrismaOrderRepository(prisma),
    printProvider,
  ),
  uploadDir: UPLOAD_DIR,
});

app.listen(PORT, () => {
  console.log(`[sweettoon-server] listening on :${PORT}`);
});
