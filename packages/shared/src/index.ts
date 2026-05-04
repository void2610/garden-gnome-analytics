// 共有スキーマと型のバレル export
export * from './events';
export * from './meta';
export * from './result';

// 通常ログのレベルと entry 型
export type NormalLogLevel = 'Log' | 'Error' | 'Exception' | 'LogManager' | 'Warning';

export interface NormalLogEntry {
  // ローカル時刻 ISO 文字列
  timestamp: string;
  date: Date;
  level: NormalLogLevel;
  message: string;
  stackTrace?: string;
}

// 1 ラン分の集約結果
export interface RawRunFile {
  filePath: string;
  runId: string;
  events: import('./events').RunEvent[];
}

// (a)(b) 突合結果
export interface CorrelatedRun {
  runId: string;
  filePath: string;
  events: import('./events').RunEvent[];
  startedAt: Date | undefined;
  endedAt: Date | undefined;
  // この run の時刻範囲に紐付いた通常ログのエラー類
  relatedErrors: NormalLogEntry[];
}
