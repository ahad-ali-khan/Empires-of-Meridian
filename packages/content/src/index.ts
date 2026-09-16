export const CONTENT_VERSION = '0.1.0';

export type StableId = string;
export type ContentEnvelope<T> = { id: StableId; version: number; data: T };

export const assertStableId = (id: string): StableId => {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid stable content id: ${id}`);
  }
  return id;
};
