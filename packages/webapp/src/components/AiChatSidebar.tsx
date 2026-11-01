import type Anthropic from '@anthropic-ai/sdk';
import {
  APIError,
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Code,
  Group,
  Loader,
  Paper,
  PasswordInput,
  ScrollArea,
  Spoiler,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
  TypographyStylesProvider,
} from '@mantine/core';
import { IconKey, IconPlayerStop, IconSend, IconTrash, IconX } from '@tabler/icons-react';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useManifest } from '../hooks/useManifest';
import { loadApiKey, saveApiKey } from '../lib/ai/apiKey';
import { AI_MODEL, type ChatProgress, runChatTurn } from '../lib/ai/chat';
import { buildSystemPrompt } from '../lib/ai/systemPrompt';
import { useLocalization } from '../lib/localization';

type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; id: string; sql: string; result?: string; isError?: boolean }
  | { kind: 'notice'; text: string; color: 'red' | 'yellow' };

const SUGGESTIONS = [
  'ボスまで行けたランと行けなかったランで、デッキの違いはある？',
  'チュートリアルにかかった時間と、そこで離れた人の割合を教えて',
  '1 時間あたり何人が試遊できた？待ち時間を減らすには？',
  '負けの原因になった敵を多い順に並べて',
];

export function AiChatSidebar({ onClose }: { onClose: () => void }) {
  const { data: manifest } = useManifest();
  const { data: localization } = useLocalization();
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [keyDraft, setKeyDraft] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [history, setHistory] = useState<Anthropic.Beta.BetaMessageParam[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const system = useMemo(
    () => (manifest ? buildSystemPrompt(manifest, localization) : null),
    [manifest, localization],
  );
  const datasets = useMemo(
    () =>
      manifest?.datasets.map((d) => ({ eventSlug: d.eventSlug, deviceSlug: d.deviceSlug })) ?? [],
    [manifest],
  );

  // 回答が伸びるたびに一番下まで送る
  useEffect(() => {
    if (items.length === 0) return;
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight });
  }, [items]);

  const applyProgress = (progress: ChatProgress) => {
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (progress.type === 'text') {
        if (last?.kind === 'assistant')
          next[next.length - 1] = { ...last, text: last.text + progress.text };
        else next.push({ kind: 'assistant', text: progress.text });
      } else if (progress.type === 'tool_start') {
        next.push({ kind: 'tool', id: progress.id, sql: progress.sql });
      } else {
        const index = next.findIndex((item) => item.kind === 'tool' && item.id === progress.id);
        if (index >= 0)
          next[index] = {
            ...(next[index] as ChatItem & { kind: 'tool' }),
            result: progress.result,
            isError: progress.isError,
          };
      }
      return next;
    });
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || running || !system) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setInput('');
    setRunning(true);
    setItems((prev) => [...prev, { kind: 'user', text: question }]);
    try {
      const result = await runChatTurn({
        apiKey,
        system,
        datasets,
        messages: [...history, { role: 'user', content: question }],
        onProgress: applyProgress,
        signal: controller.signal,
      });
      setHistory(result.messages);
      if (result.stopReason === 'refusal') {
        setItems((prev) => [
          ...prev,
          {
            kind: 'notice',
            text: 'この質問には答えられませんでした。聞き方を変えてみてください。',
            color: 'yellow',
          },
        ]);
      } else if (result.stopReason === 'max_tokens') {
        setItems((prev) => [
          ...prev,
          { kind: 'notice', text: '回答が長すぎて途中で切れました。', color: 'yellow' },
        ]);
      }
    } catch (e) {
      setItems((prev) => [
        ...prev,
        {
          kind: 'notice',
          text: describeError(e),
          color: e instanceof APIUserAbortError ? 'yellow' : 'red',
        },
      ]);
      // 途中で止めた問いかけは会話に残さず、次は止める前の会話から続ける
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換を確定する Enter では送らない
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setItems([]);
    setHistory([]);
  };

  return (
    <Stack h="100%" gap={0}>
      <Group justify="space-between" p="sm" wrap="nowrap">
        <Title order={5}>AI に聞く</Title>
        <Group gap={4} wrap="nowrap">
          {apiKey && (
            <Tooltip label="API キーを入れ直す">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="API キーを入れ直す"
                onClick={() => setApiKey('')}
              >
                <IconKey size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="会話を消す">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="会話を消す"
              onClick={clear}
              disabled={items.length === 0}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon variant="subtle" color="gray" aria-label="閉じる" onClick={onClose}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {!apiKey ? (
        <Stack p="sm" gap="sm">
          <Text size="sm">
            Claude の API
            キーを入れると、試遊ログについて質問できます。キーはこのブラウザにだけ保存され、Anthropic
            の API へ直接送られます。
          </Text>
          <Anchor href="https://platform.claude.com/settings/keys" target="_blank" size="sm">
            API キーを発行する
          </Anchor>
          <PasswordInput
            placeholder="sk-ant-..."
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.currentTarget.value)}
            aria-label="Claude の API キー"
          />
          <Button
            disabled={!keyDraft.trim()}
            onClick={() => {
              saveApiKey(keyDraft.trim());
              setApiKey(keyDraft.trim());
              setKeyDraft('');
            }}
          >
            保存する
          </Button>
          <Button variant="subtle" color="gray" size="xs" onClick={() => saveApiKey('')}>
            保存済みのキーを消す
          </Button>
        </Stack>
      ) : (
        <>
          <ScrollArea flex={1} viewportRef={viewportRef} px="sm">
            <Stack gap="sm" pb="sm">
              {items.length === 0 && (
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    ゲームバランスや試遊の回し方について聞いてください。AI がログを SQL
                    で調べて答えます ({AI_MODEL})。
                  </Text>
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="light"
                      size="xs"
                      justify="start"
                      styles={{ label: { whiteSpace: 'normal', textAlign: 'left' } }}
                      h="auto"
                      py={6}
                      onClick={() => void send(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </Stack>
              )}
              {items.map((item, i) => (
                <ChatItemView
                  key={item.kind === 'tool' ? item.id : `${item.kind}-${i}`}
                  item={item}
                />
              ))}
              {running && <Loader size="xs" />}
            </Stack>
          </ScrollArea>
          <Box p="sm">
            <Textarea
              placeholder="質問を入力 (Enter で送信、Shift+Enter で改行)"
              autosize
              minRows={2}
              maxRows={8}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              disabled={!system}
            />
            <Group justify="flex-end" mt="xs">
              {running ? (
                <Button
                  size="xs"
                  color="gray"
                  leftSection={<IconPlayerStop size={14} />}
                  onClick={() => abortRef.current?.abort()}
                >
                  止める
                </Button>
              ) : (
                <Button
                  size="xs"
                  leftSection={<IconSend size={14} />}
                  onClick={() => void send(input)}
                  disabled={!input.trim() || !system}
                >
                  送信
                </Button>
              )}
            </Group>
          </Box>
        </>
      )}
    </Stack>
  );
}

function ChatItemView({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <Paper bg="var(--mantine-primary-color-light)" p="xs" radius="md" ml="xl">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {item.text}
          </Text>
        </Paper>
      );
    case 'assistant':
      return (
        <TypographyStylesProvider fz="sm" p={0}>
          <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
        </TypographyStylesProvider>
      );
    case 'tool':
      return (
        <Paper withBorder p="xs" radius="md">
          <Group gap={6} mb={4}>
            {item.result === undefined && <Loader size={10} />}
            <Text size="xs" c={item.isError ? 'red' : 'dimmed'}>
              {item.result === undefined
                ? 'SQL を実行中'
                : item.isError
                  ? 'SQL が失敗しました'
                  : 'SQL を実行しました'}
            </Text>
          </Group>
          <Spoiler
            maxHeight={60}
            showLabel="全部見る"
            hideLabel="たたむ"
            styles={{ control: { fontSize: 11 } }}
          >
            <Code block fz={11}>
              {item.sql}
            </Code>
            {item.isError && (
              <Text size="xs" c="red" mt={4}>
                {item.result}
              </Text>
            )}
          </Spoiler>
        </Paper>
      );
    case 'notice':
      return (
        <Alert color={item.color} p="xs">
          <Text size="sm">{item.text}</Text>
        </Alert>
      );
  }
}

function describeError(e: unknown): string {
  if (e instanceof APIUserAbortError) return '止めました。';
  if (e instanceof AuthenticationError)
    return 'API キーが正しくありません。右上の鍵のボタンから入れ直してください。';
  if (e instanceof RateLimitError)
    return 'API の利用上限に達しました。少し待ってから送り直してください。';
  if (e instanceof APIError) return `API のエラー (${e.status ?? '通信'}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
