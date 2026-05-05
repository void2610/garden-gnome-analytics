#!/usr/bin/env node
// pnpm ingest 用のエントリポイント
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pino from 'pino';
import { parse as parseYaml } from 'yaml';
import { runIngest } from '../ingest';

interface CliArgs {
  dataDir: string;
  outDir: string;
  dev: boolean;
  clean: boolean;
  filter: string | undefined;
  // 除外設定の YAML パス。デフォルトは <cwd>/config/exclude_errors.yaml
  excludeConfig: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dataDir: './data',
    outDir: './public-data',
    dev: false,
    clean: false,
    filter: undefined,
    excludeConfig: './config/exclude_errors.yaml',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--data-dir':
        args.dataDir = argv[++i] ?? args.dataDir;
        break;
      case '--out':
        args.outDir = argv[++i] ?? args.outDir;
        break;
      case '--dev':
        args.dev = true;
        break;
      case '--clean':
        args.clean = true;
        break;
      case '--filter':
        args.filter = argv[++i];
        break;
      case '--exclude-config':
        args.excludeConfig = argv[++i] ?? args.excludeConfig;
        break;
      case '-h':
      case '--help':
        printHelpAndExit();
        break;
    }
  }
  return args;
}

function printHelpAndExit(): never {
  console.log(`使い方:
  pnpm ingest [--data-dir <path>] [--out <path>] [--dev] [--clean]
              [--filter <event-slug>] [--exclude-config <path>]
`);
  process.exit(0);
}

// config/exclude_errors.yaml を読み込んで patterns 配列を返す。
// ファイルが無ければ空配列を返す (除外なし)。
async function loadExcludePatterns(path: string, log: pino.Logger): Promise<string[]> {
  const abs = resolve(path);
  try {
    const text = await readFile(abs, 'utf8');
    const obj = parseYaml(text);
    const patterns = (obj as { patterns?: unknown })?.patterns;
    if (!Array.isArray(patterns)) {
      log.warn(`${abs}: patterns が配列ではありません`);
      return [];
    }
    const result = patterns.filter((p): p is string => typeof p === 'string');
    if (result.length > 0) {
      log.info(`除外パターン読込: ${abs} (${result.length} 件)`);
    }
    return result;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      log.warn(`${abs} 読み込み失敗: ${err.message}`);
    }
    return [];
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logger = pino({
    level: 'info',
    transport: process.stdout.isTTY
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  });
  const excludeErrorPatterns = await loadExcludePatterns(args.excludeConfig, logger);
  const t0 = Date.now();
  const result = await runIngest({ ...args, excludeErrorPatterns, logger });
  const dt = Date.now() - t0;
  logger.info(
    `summary: datasets=${result.datasets} events=${result.events} runs=${result.runs} errors=${result.errors} (${dt}ms)`,
  );
  if (result.warnings.length > 0) {
    logger.warn(`warnings: ${result.warnings.length} (先頭 5 件のみ表示)`);
    for (const w of result.warnings.slice(0, 5)) logger.warn(w);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
