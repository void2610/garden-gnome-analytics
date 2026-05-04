// クエリエラーを画面に表示する小コンポーネント
import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export function QueryError({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <Alert color="red" icon={<IconAlertTriangle size={16} />} title="クエリ失敗" mt="sm">
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{msg}</pre>
    </Alert>
  );
}
