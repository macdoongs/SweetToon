import { z } from "zod";

export const DemoBotSpeedSchema = z.enum(["slow", "normal", "fast"]);

export const DemoBotStatusSchema = z.object({
  available: z.boolean(),
  running: z.boolean(),
  leader: z.boolean(),
  readerCount: z.number().int().min(0).max(30),
  activeBotCount: z.number().int().min(0).max(31),
  speed: DemoBotSpeedSchema,
  tickIntervalSeconds: z.number().int().positive(),
  lastTickAt: z.string().datetime().nullable(),
  nextTickAt: z.string().datetime().nullable(),
  activeOrderId: z.string().nullable(),
  lastAction: z.string().nullable(),
});

export const DemoBotUpdateSchema = z
  .object({
    running: z.boolean().optional(),
    readerCount: z.number().int().min(0).max(30).optional(),
    speed: DemoBotSpeedSchema.optional(),
  })
  .refine(
    (value) =>
      value.running !== undefined ||
      value.readerCount !== undefined ||
      value.speed !== undefined,
  );

export type DemoBotSpeed = z.infer<typeof DemoBotSpeedSchema>;
export type DemoBotStatus = z.infer<typeof DemoBotStatusSchema>;
export type DemoBotUpdate = z.infer<typeof DemoBotUpdateSchema>;
