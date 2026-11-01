// AI チャットの 1 回の問いかけを、SQL のツール呼び出しを挟みながら最後まで進める
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { type DatasetRef, runReadOnlySql } from './sql';

export const AI_MODEL = 'claude-opus-5-5';

const RunSqlInput = z.object({ sql: z.string().min(1) });

const RUN_SQL_TOOL: Anthropic.Beta.BetaTool = {
  name: 'run_sql',
  description:
    'DuckDB の SQL を 1 文実行し、結果を JSON で返す。読める表は events / runs / errors の 3 つのビュー。' +
    'SELECT / WITH / DESCRIBE / SUMMARIZE などの読むだけの文しか実行できない。' +
    '返す行は 200 行までなので、集計してから返すこと。',
  input_schema: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: '実行する DuckDB の SQL (1 文)' },
    },
    required: ['sql'],
    additionalProperties: false,
  },
  eager_input_streaming: true,
};

export type ChatProgress =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; id: string; sql: string }
  | { type: 'tool_end'; id: string; result: string; isError: boolean };

export interface ChatTurnOptions {
  apiKey: string;
  system: string;
  datasets: DatasetRef[];
  // これまでの会話。返ったメッセージは手を加えずに次の問いかけへ渡す (思考のブロックは会話ごとに結び付いている)
  messages: Anthropic.Beta.BetaMessageParam[];
  onProgress: (progress: ChatProgress) => void;
  signal: AbortSignal;
}

export interface ChatTurnResult {
  messages: Anthropic.Beta.BetaMessageParam[];
  stopReason: Anthropic.Beta.BetaStopReason | null;
}

export async function runChatTurn(options: ChatTurnOptions): Promise<ChatTurnResult> {
  const { apiKey, system, datasets, onProgress, signal } = options;
  // 静的サイトでバックエンドを持たないので、利用者が入力した自分のキーでブラウザから直接呼ぶ
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const messages = [...options.messages];
  let jsonRetries = 0;

  while (true) {
    const stream = client.beta.messages.stream(
      {
        model: AI_MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high' },
        cache_control: { type: 'ephemeral' },
        system,
        tools: [RUN_SQL_TOOL],
        messages,
      },
      { signal },
    );
    stream.on('text', (delta) => onProgress({ type: 'text', text: delta }));

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // ツールの入力の JSON が壊れていたときだけ、同じ問いかけをやり直す
      if (err instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw err;
      continue;
    }

    messages.push({ role: 'assistant', content: message.content });
    if (message.stop_reason === 'pause_turn') continue;
    if (message.stop_reason !== 'tool_use') return { messages, stopReason: message.stop_reason };

    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use',
    );
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      results.push(await runTool(toolUse, datasets, onProgress));
    }
    messages.push({ role: 'user', content: results });
  }
}

async function runTool(
  toolUse: Anthropic.Beta.BetaToolUseBlock,
  datasets: DatasetRef[],
  onProgress: (progress: ChatProgress) => void,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const parsed = RunSqlInput.safeParse(toolUse.input);
  if (toolUse.name !== 'run_sql' || !parsed.success) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      is_error: true,
      content: `入力が不正です: ${JSON.stringify(toolUse.input)}`,
    };
  }
  onProgress({ type: 'tool_start', id: toolUse.id, sql: parsed.data.sql });
  try {
    const result = await runReadOnlySql(parsed.data.sql, datasets);
    onProgress({ type: 'tool_end', id: toolUse.id, result, isError: false });
    return { type: 'tool_result', tool_use_id: toolUse.id, content: result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    onProgress({ type: 'tool_end', id: toolUse.id, result: message, isError: true });
    return { type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: message };
  }
}
