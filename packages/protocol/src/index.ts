import type { Command } from '@meridian/sim';

export const PROTOCOL_VERSION = 1;
export type CommandEnvelope = { protocolVersion: number; command: Command };
export type SnapshotEnvelope = {
  protocolVersion: number;
  tick: number;
  contentVersion: string;
  checksum: string;
  state: unknown;
};

export const isProtocolVersion = (version: number): version is typeof PROTOCOL_VERSION =>
  version === PROTOCOL_VERSION;
