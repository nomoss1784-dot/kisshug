# キスハグ / KissHug

3つ並べ（○×ゲーム）系の対戦ゲーム。勝った方が負けた方にキスかハグをする。NOMOSS 名義。

- Web版: https://nomoss1784-dot.github.io/kisshug/
- 仕様: [SPEC.md](SPEC.md) ／ 完了報告: [REPORT.md](REPORT.md)

## 起動

```bash
npm install
npm run dev              # http://localhost:5173
npm run build            # dist/ (Web版)
npm run build:playables  # dist-playables/ と kisshug-playables.zip
npm test                 # 盤面ロジック・AI の単体テスト (Vitest)
npm run test:e2e         # Playwright (レイアウト・通信ゼロ・19×19タッチ・AI・SDKモック・ZIP)
```

Playables SDK のローカルモック: `http://localhost:5173/?mock=playables&lang=ja`

## 構成

```
src/game      盤面ロジック（純粋関数）      src/ai        AI（Web Worker）
src/scenes    画面                          src/fx        演出エンジン（純粋タイムライン）＋描画
src/art       ポーズ画像ローダ＋ぬいぐるみ風 SVG フォールバック
src/photo     写真の読み込み・円形クロップ   src/platform  Web / Playables 抽象層
src/i18n      ja.json / en.json             assets/       ポーズ画像スロット・anchors.json・効果音（作り方: ART_PROMPTS.md）
tests/        単体テスト                     e2e/          Playwright
```
