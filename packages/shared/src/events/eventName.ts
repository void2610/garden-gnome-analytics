import { RUN_EVENT_SCHEMAS } from './payloads';

export type EventName = (typeof RUN_EVENT_SCHEMAS)[number]['shape']['event']['value'];

// スキーマの一覧から作るので、スキーマを足せばそのイベントも読めるようになる
export const KNOWN_EVENT_NAMES: ReadonlyArray<EventName> = RUN_EVENT_SCHEMAS.map(
  (schema) => schema.shape.event.value,
);
