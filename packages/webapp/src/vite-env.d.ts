/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 公開サイトの JS から誰でも読めるので、上限額を付けた専用のキーを使う
  readonly VITE_ANTHROPIC_API_KEY?: string;
}
