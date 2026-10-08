export type EnvironmentWeather = 'clear' | 'windy' | 'overcast' | 'mist' | 'rain' | 'storm';
export const PROTOCOL_VERSION = 1;
export const TICKS_PER_SECOND = 20;
export const WORLD_SCALE = 256;
export const RESOURCE_SCALE = 100;

export type PlayerId = 1 | 2 | 3 | 4;
export type ResourceKind = 'provisions' | 'timber' | 'coin' | 'metal';
export type Resources = Record<ResourceKind, number>;
export type Difficulty = 'relaxed' | 'standard' | 'ruthless';
export type Formation = 'line' | 'column' | 'spread' | 'square' | 'wedge' | 'loose';
export type Stance = 'aggressive' | 'defensive' | 'stand-ground' | 'no-attack';
export type OfflineCheat = 'resources' | 'tokens' | 'heal' | 'construction' | 'production' | 'reveal';
export type Command =
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'offline-cheat';
      cheat: OfflineCheat;
      entityIds: number[];
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'rally';
      buildingIds: number[];
      x: number;
      z: number;
      targetId?: number;
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'resume-build' | 'garrison';
      queued?: boolean;
      entityIds: number[];
      targetId: number;
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'ungarrison';
      buildingId: number;
      returnToWork?: boolean;
    }
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'stop'; entityIds: number[]}
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'move' | 'attack-move' | 'patrol';
      queued?: boolean;
      entityIds: number[];
      x: number;
      z: number;
      formation?: Formation;
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'gather' | 'attack' | 'guard' | 'heal' | 'collect-treasure' | 'claim-site' | 'revive';
      queued?: boolean;
      entityIds: number[];
      targetId: number;
    }
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'train'; buildingId: number; unitId: string}
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'research';
      buildingId: number;
      technologyId: string;
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'cancel-production';
      buildingId: number;
      queueId: number;
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'build';
      queued?: boolean;
      workerIds: number[];
      buildingId: string;
      x: number;
      z: number;
      rotation?: 0 | 1 | 2 | 3;
      endX?: number;
      endZ?: number;
    }
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'cancel-construction'; buildingId: number}
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'convert-gate'; buildingId: number}
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'advance'; councilId: string}
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'dispatch'; dispatchId: string}
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'cancel-dispatch'; dispatchId: string}
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'stance'; entityIds: number[]; stance: Stance}
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'exchange';
      buildingId: number;
      resource: Exclude<ResourceKind, 'coin'>;
      direction: 'buy' | 'sell';
    }
  | {
      v: 1;
      tick: number;
      playerId: PlayerId;
      sequence: number;
      type: 'site-income';
      siteId: number;
      resource: ResourceKind;
    }
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'recall-explorer'; entityId: number}
  | {v: 1; tick: number; playerId: PlayerId; sequence: number; type: 'resign'};

export interface MatchConfig {
  v: 1;
  seed: number;
  difficulty: Difficulty;
  mode: 'skirmish' | 'tutorial';
  populationCap: number;
  gameSpeed: number;
  mapSize?: 'small' | 'medium' | 'large';
  fogOfWar?: boolean;
  aiCount?: 0 | 1 | 2 | 3;
  /** Set only by the local match worker. Network hosts never accept this capability. */
  offlineCheats?: boolean;
}
export interface SaveEnvelope {
  v: 1;
  contentVersion: number;
  mapVersion: number;
  protocolVersion: number;
  state: string;
  commandLog: Command[];
  checksum: string;
}
export interface WorkerRequest {
  type: 'create' | 'commands' | 'save' | 'load' | 'pause' | 'resume';
  config?: MatchConfig;
  commands?: Command[];
  save?: SaveEnvelope;
}
export interface WorkerResponse {
  type: 'snapshot' | 'saved' | 'error';
  snapshot?: unknown;
  save?: SaveEnvelope;
  message?: string;
}
