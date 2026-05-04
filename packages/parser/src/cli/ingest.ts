#!/usr/bin/env node
// pnpm ingest 用のエントリポイント
import pino from 'pino';
import { runIngest } from '../ingest';

interface CliArgs {
  dataDir: string;
  outDir: string;
  dev: boolean;
  clean: boolean;
  filter: string | undefined;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dataDir: './data',
    outDir: './public-data',
    dev: false,
    clean: false,
    filter: undefined,
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
  pnpm ingest [--data-dir <path>] [--out <path>] [--dev] [--clean] [--filter <event-slug>]
`);
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logger = pino({
    level: 'info',
    transport: process.stdout.isTTY
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  });
  const t0 = Date.now();
  const result = await runIngest({ ...args, logger });
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
