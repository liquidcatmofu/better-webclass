# Better WebClass

WebClass（大学向け LMS）の利便性を向上させる Chrome 拡張機能です。

## 機能

### ファイルハンドラ
- 課題・レポートの PDF をポップアップウィンドウではなくモーダルで表示
- 資料閲覧ページに **↓ DL** / **↓ 科目名DL** ボタンを追加し、正しいファイル名でダウンロード可能に
- メッセージをモーダルで表示（閉じると自動でリロード）

### UI 改善
- テーブルの交互着色
- フローティングの「トップへ戻る」ボタン
- コンテンツグループの折りたたみ／展開（アイテム数・期限バッジを表示）

### 課題トラッカー
- 締め切りまでの残日数をバッジで表示（今日中 / 明日まで / あとN日 / 期限切れ / 提出済）

## 対応 URL

- `https://*.ac.jp/*`
- `https://webclass.kosen-k.go.jp/*`
- `https://*.webclass.jp/*`

ポップアップの「WebClass URL」欄に自分の大学の URL を入力することで有効になります。

## インストール（開発版）

```bash
git clone https://github.com/liquidcatmofu/better-webclass.git
cd better-webclass
npm install
npm run build
```

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist/` フォルダを選択

## 開発

```bash
npm run dev   # ウォッチモード（変更を検知して自動ビルド）
npm run build # プロダクションビルド
```

## 技術スタック

- TypeScript + Vite
- [vite-plugin-web-extension](https://vite-plugin-web-extension.aklinker1.io/)
- Chrome Manifest V3
