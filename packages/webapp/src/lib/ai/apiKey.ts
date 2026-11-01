// Claude の API キーはこのブラウザにだけ保存する。保存できない環境 (プライベートウィンドウ等) では入力し直してもらう
const STORAGE_KEY = 'gga.anthropicApiKey';

export function loadApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(apiKey: string): void {
  try {
    if (apiKey) localStorage.setItem(STORAGE_KEY, apiKey);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存できなくても、このページを開いている間は使える
  }
}
