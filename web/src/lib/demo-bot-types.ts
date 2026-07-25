export type DemoBotSpeed = "slow" | "normal" | "fast";

export type DemoBotStatus = {
  available: boolean;
  running: boolean;
  leader: boolean;
  readerCount: number;
  activeBotCount: number;
  speed: DemoBotSpeed;
  tickIntervalSeconds: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
  activeOrderId: string | null;
  lastAction: string | null;
};

export type DemoBotUpdate = {
  running?: boolean;
  readerCount?: number;
  speed?: DemoBotSpeed;
};
