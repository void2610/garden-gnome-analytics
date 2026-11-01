// Claude の API キーは、ビルド時に GitHub の secret から埋め込む。無いビルドでは AI チャットを使えない
export const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
