// パース結果の Result 型と各種パースエラー
export type Result<T, E = ParseError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type ParseErrorKind = 'tokenize' | 'schema' | 'unknown_event';

export interface ParseError {
  kind: ParseErrorKind;
  line: string;
  lineNumber: number;
  message: string;
  cause?: unknown;
}

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
