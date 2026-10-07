# キスハグ / KissHug — 完了報告 REPORT.md

- 日付: 2026-10-08
- 仕様: SPEC.md v0.2 のフェーズ1〜3を実装済み
- 実装分担: 盤面ロジック（`src/game/`）と AI（`src/ai/`）＋その単体テストは Codex、その他（画面・リグ・写真・プラットフォーム層・ビルド・e2e）は Claude Code

---

## 1. 起動方法

```bash
npm install
npm run dev              # 開発サーバ http://localhost:5173
npm run build            # Web版 → dist/
npm run build:playables  # Playables版 → dist-playables/ と提出用 kisshug-playables.zip（index.html がルート）
npm test                 # 単体テスト（Vitest）: 盤面・勝利判定・AI
npm run test:e2e         # Playwright: レイアウト／通信ゼロ／19×19タッチ／AI／SDKモック／ZIP
npm run typecheck
```

- 静的サーバで動かすだけなら `npm run build` 後に `npm run preview`（http://localhost:4173）。
- Playables SDK のローカルモック: URL に `?mock=playables&lang=ja` を付ける（`window.__ytmock` で pause/resume/音声/言語を操作できる）。
- プレースホルダ画像の再生成: `node scripts/gen-placeholders.mjs`。サムネイル再生成: `npm run build && npm run preview` を起動した状態で `node scripts/gen-thumbnails.mjs`。

## 2. 公開URL

- **Web版（HTTPS）: https://nomoss1784-dot.github.io/kisshug/**
- リポジトリ: https://github.com/nomoss1784-dot/kisshug （public。`gh` が認証済みだったので作成した）
- デプロイ方式: `dist/` を `gh-pages` ブランチに push → GitHub Pages（source = gh-pages, /）。更新手順は §7 末尾。
- 提出用 ZIP: `npm run build:playables` で `kisshug-playables.zip`（158KB）を生成。

## 3. フェーズごとの完了条件チェック結果

### フェーズ1: Web版コア
| 条件 | 結果 | 根拠 |
|---|---|---|
| `game/` 単体テスト: 任意の (size, k) で勝利判定が正しい | ✅ | `tests/winCheck.test.ts`（size 3〜19, k 3〜6 の縦横斜め・k+1・遮断・引き分け・最終手の高速判定と全走査の一致 200局） |
| AI「つよい」が 3×3 で 1000 局負けなし | ✅ | `tests/ai3x3.test.ts`（先手 500 局＋後手 500 局 vs 乱数、負け 0。つよい同士は 10 局すべて引き分け） |
| iPhone縦・Android縦・PC横・1:1 の4パターンで崩れない | ✅ | `e2e/layout.spec.ts`。390×844 / 360×800 / 1280×720 / 800×800 に加え極端比 360×1280（9:32）と 1280×360（32:9）も確認。ボタンが画面内に収まること・盤が正方形で画面内にあること・回転しても対局状態が保持されることを検証。スクショは `e2e/screenshots/` |
| 初期ロード 5MB 以下 | ✅ | `e2e/network.spec.ts`: タイトル表示までの転送量 **95KB / 36 リクエスト**。dist 全体 312KB（JS 90KB、画像 192KB） |
| 外部通信ゼロ | ✅ | `e2e/network.spec.ts`: 自ホスト以外のリクエスト 0 件（初期ロード・写真モード一式）。公開 URL でも 0 件を確認 |
| `dist/` がローカルの静的サーバで動く | ✅ | `vite preview`（Playwright の webServer）で全 e2e を実行。GitHub Pages でも動作 |

### フェーズ2: 機能拡張
| 条件 | 結果 | 根拠 |
|---|---|---|
| 19×19 をスマホ縦（幅360px）で誤タップなく打てる | ✅ | `e2e/board19.spec.ts`（Playwright タッチエミュレーション、360×740）: 四隅・中央・ランダム計10マスを「タップ→拡大レンズ確認→もう一度タップ」で狙い通り配置。レンズ内タップでの隣接マス修正、「ここに置く」ボタン、埋まったマスは無反応、ピンチ後のタップ精度、ダブルタップでズームリセット |
| AI思考がUIを止めない（1.5秒上限） | ✅ | `e2e/ai.spec.ts`: 15×15「つよい」の思考中 1 秒間に **61 フレーム**描画、応答 **1514ms**（Web Worker、上限 1500ms＋通信オーバーヘッド） |
| 写真が端末外に出ない | ✅ | `e2e/network.spec.ts`: `input type=file` に PNG を投入→切り抜き→対局→キス演出まで通して自ホスト以外のリクエスト 0 件。写真は `data:` URL としてメモリ保持、保存は明示オプトインのみ |

その他実装: Lv2（9×9）、Lv3（15/17/19）、ピンチズーム・ドラッグ・ダブルタップ、2段階入力＋拡大レンズ、直前手マーカー、2人対戦（手番表示大・先手表示）、動物ごとの決めポーズ（ねこ: しっぽハート、いぬ: 高速しっぽ振り、うさぎ: 耳ピン、くま: 持ち上げハグ）、写真モード（円形クロップ・体色4色・保存オプトイン・設定から削除）。

### フェーズ3: Playables対応
| 条件 | 結果 | 根拠 |
|---|---|---|
| SDKモック上で `firstFrameReady` → `gameReady` が起動から 3 秒以内 | ✅ | `e2e/playables.spec.ts`: 両方が順番通り呼ばれ、`gameReady` は起動後 1 秒未満 |
| pause/resume で AI思考と演出が止まる・再開する | ✅ | 同上: pause 中は AI リクエスト取消・着手なし、resume で再思考して着手。結果演出のタイマーも停止／再開 |
| ZIP を展開して `index.html` を開くだけで動く | ✅ | `e2e/zip.spec.ts`: ZIP を展開し `file://` で開いてタイトル表示・AI着手・外部通信 0・エラー 0 を確認 |
| `REPORT.md` が揃っている | ✅ | 本書 |

SDK 連携一覧（`src/platform/playables.ts`）: `firstFrameReady`/`gameReady`、`onPause`/`onResume`、`isAudioEnabled`/`onAudioEnabledChange`（効果音ON/OFF追従）、`getLanguage`（ja/en）、`saveData`/`loadData`（設定・戦績・オプトイン写真を1つの JSON にまとめて保存）、`sendScore`（つよいAIへの連勝数）、`requestInterstitialAd`（3対局ごとの結果画面を閉じるとき）、`requestRewardedAd`（`Platform.showRewarded()` としてフックのみ）、`logError`/`logWarning`、`IN_PLAYABLES_ENV`。ゲーム本体は `Platform` インターフェース以外から SDK に触らない。

## 4. 仕様書から判断で決めたこと、変えたことと理由

1. **ゲームエンジン: Phaser ではなく plain Canvas 2D**（§9.1/§11 で許容）。理由: バンドルが 90KB（Phaser は約 1.3MB）で `gameReady` までが軽い、DPR と文字のにじみを完全に制御できる、依存ゼロで Playables の CSP/オフライン要件に強い。シーン管理・トゥイーン・ジェスチャ認識は `src/ui/` に自前実装（約 600 行）。
2. **ビルドを単一の classic `<script defer>`（IIFE）にした。** ES module だと「ZIP を展開して index.html を開くだけ」（file://）で動かないため。`rig.json` と効果音マニフェストも fetch ではなくビルド時にバンドル（ファイル自体は仕様通り `assets/` に置いてあり、編集すれば反映される）。
3. **Worker が使えない環境ではメインスレッドで探索**（file:// では Chrome が Worker を拒否する）。http 配信では常に Worker。
4. **効果音は WebAudio で合成**（音声ファイル 0 バイト）。`assets/sfx/manifest.json` に `"place": "./sfx/place.mp3"` のように書けばファイル再生に切り替わる（§9.5 の OGG/MP3 差し替え前提）。
5. **Lv3 の盤サイズは 15 / 17 / 19 の3択**（§5 は 17 を許容、§11 は 15/19 の2択で矛盾。上位互換として 3 択。既定 15）。
6. **2段階入力の確定とダブルタップの両立**: マス選択後 0.3 秒以上おいて同じマスを再タップで確定、素早いダブルタップはズームリセット（選択も解除）。確定は「ここに置く」ボタンでも可。ズーム中は盤右上に「⤢」リセットボタンも出す。
7. **拡大レンズ**: 選択マスの周辺 5×5 を円形レンズに拡大表示し、レンズ内のマスを直接タップして選び直せる（19×19 の 18px マスでも 30px 以上で狙える）。
8. **クラシックの陣営**: プレイヤー1 = ○（ハグ）、プレイヤー2／AI = ✗（キス）。先手は対局ごとに交代するので ✗ が先手になることもある（§4 の交代ルールを優先）。
9. **AI のご褒美**は対局ごとにランダム、「もう一回」でも再抽選。AI の動物もランダム（同じ動物なら色相を 30° ずらす）。
10. **写真モードの頭**: 耳としっぽは描かない（人の顔に動物の耳は不自然）。感情は頬の赤み・ハート・キラキラの重ね描きで表現（§6.4）。写真プレイヤーの名前は「プレイヤー1/2」。
11. **写真の保存**: 「次回も使う」トグルON時のみ `Platform.save`（Web: localStorage、Playables: saveData）。256×256 PNG の data URL（1枚 50〜150KB）なので 3MiB に収まる。設定画面の「保存した写真を消す」で削除。
12. **言語**: 初回は端末／YouTube の言語（ja なら日本語、他は英語）。設定で明示切替。
13. **初回の演出はスキップ不可、2回目以降はタップでスキップ**（キス・ハグ・握手それぞれ別に記録）。
14. **キーボード**: Esc で設定・選択中マスを閉じる（`preventDefault` しない）、Enter で選択マス確定、Enter/Space でタイトルから開始。
15. **サムネイル**はタイトル画面の 4 キャラだけ（文字・ロゴなし）を 16:9 / 9:16 / 1:1 / 4:3 で `submission/thumbnails/` に生成。
16. **デバッグ用フック** `window.__kisshug` を本番ビルドにも残している（e2e が使用。数十バイト。消す場合は `src/main.ts` 末尾）。
17. **5体目スロット**: キャラ選択に「？」のロック枠を置き、タップで「いつかなかまがふえるかも」を表示。`Platform.showRewarded()` は用意したが UI からは呼ばない（解放対象がないため）。
18. **カメラ直接撮影（getUserMedia, MAY）**: 未実装。Playables の iframe 内で動くか不明なため（§7.1 の方針通り）。

## 5. できなかったことと理由

- **実機（iPhone Safari / Android Chrome）での確認**: Chromium のエミュレーション（Playwright, タッチ・DPR 2）でのみ検証。ピンチは 2 本指のエミュレーションができないため、ジェスチャ認識器（`src/ui/app.ts`）の出力を直接呼んでカメラ計算を検証した。実機では §12 の Test Suite 確認と合わせて触ってほしい。
- **Playables 本番環境**（Developer Portal / Test Suite）: アクセス不可のため `src/platform/mock.ts` のモックで代替。SDK の API 形は公式リファレンス（`ytgame.game / system / engagement / ads / health`）に合わせてある。
- **本番アート・効果音**: すべてプレースホルダ（§6.3 の構造に従い PNG 差し替えだけで本番化できる。手順は §7）。
- **安いAndroid端末での性能**: 未計測。描画は毎フレーム全再描画だが 19×19 でも可視セルのみ描画、Playwright 上で 60fps。

## 6. 人間タスク一覧（§12）

1. NOMOSS 名義の YouTube チャンネル作成
2. Playables 興味表明フォームへの申請（公開URL https://nomoss1784-dot.github.io/kisshug/ を添えて）
3. 承認後、Developer Portal の Test Suite で動作確認。特に **写真モードの `input type=file`** が iframe 内で動くか。動かない場合は `vite.config.ts` の `__PHOTO_MODE_ENABLED__` を `mode === 'playables' ? false : true` にして Playables 版だけ写真モードを隠す（モード選択から消える）
4. 本番アート PNG の差し替え（§7）
5. サムネイルの本番化（`submission/thumbnails/` のプレースホルダを置き換え。ロゴ・文字なし）
6. 効果音の本番化（任意。`assets/sfx/` に置いて `manifest.json` に登録）
7. 審査提出（タイトル: キスハグ / KissHug、ジャンル: Casual、パブリッシャー: NOMOSS、ZIP: `kisshug-playables.zip`）
8. 実機での触り心地確認（19×19 のレンズ・ピンチ）

## 7. 本番アートの差し替え手順

すべて **PNG（アルファ付き）**。キャンバスサイズと基準位置（ピボット）を守れば `assets/characters/_rig/rig.json` の変更は不要。差し替え後 `npm run build` するだけ。

### 共通パーツ `assets/characters/common/`（**白〜薄いグレーで描く**。動物の体色／写真モードのパステルは実行時に乗算で着色）
| ファイル | サイズ | 基準位置（ピボット） | 備考 |
|---|---|---|---|
| `body.png` | 512×512 | (256, 440) = 腰（足の付け根） | 首の接続点 (256, 70)、肩 L(165,110) R(347,110)、腰 L(205,400) R(307,400)、しっぽ (250,380) |
| `arm_l.png` `arm_r.png` | 256×256 | (128, 30) = 肩 | 腕は真下に垂らした状態で描く（下端 ≈ y=215）。回転はプログラム側 |
| `leg_l.png` `leg_r.png` | 256×256 | (128, 30) = 股関節 | 真下に伸ばした状態（足裏 ≈ y=215） |

### 動物パーツ `assets/characters/{cat,dog,rabbit,bear}/`
| ファイル | サイズ | 基準位置 | 備考 |
|---|---|---|---|
| `head.png` | 512×512 | (256, 460) = 首 | 顔の円は中心 (256, 240)・半径 220 を目安（写真モードの顔もこの円に入る） |
| `head_blush.png` | 512×512 | 同上 | 頬が赤い版。キス／ハグ／握手された側に使用 |
| `ear_l.png` `ear_r.png` | 256×256 | (128, 230) = 耳の付け根 | 上向きに描く。頭への取り付け位置は L(110,70) R(402,70)。動物ごとの既定角度は `rig.json` の `animalPose` |
| `tail.png` | 256×256 | (40, 128) = 付け根 | 右向きに伸ばして描く。ねこの「ハートしっぽ」は先端 (200,100) にハートが重なる |
| `icon.png` | 256×256 | — | 盤面用・全身（Lv1 の駒） |
| `icon_face.png` | 128×128 | — | 盤面用・顔（Lv2/Lv3 の駒） |

- 同キャラ対戦の 2 体目は実行時に色相を 30° 回すので、1 色相で統一した塗りだと綺麗にずれる。
- 写真モードの体の色候補は `assets/characters/photo/body_tint.json`（表示名は `src/i18n/*.json` の `color.*`）。
- ポーズ・キーフレーム（キス／ハグ／握手／考え中／歩き／喜び／しょんぼり／決めポーズ）は `rig.json` の `clips`。`[時間ms, {rot, x, y, sx, sy}]` を並べるだけで調整できる。
- 効果音: `assets/sfx/` に `place / win / draw / button / kiss / hug / shake` の mp3/ogg を置き、`assets/sfx/manifest.json` に `"kiss": "./sfx/kiss.mp3"` のように登録（登録がない音は合成音のまま）。
- 確認: `npm run dev` → `?mock=playables` も併用。差し替え後は `npm run test:e2e` で容量（5MB）と外部通信ゼロが自動チェックされる。

### 公開の更新（GitHub Pages）
```bash
npm run build
cd dist && git init && git checkout -b gh-pages && touch .nojekyll && git add -A && git commit -m deploy && git push -f https://github.com/nomoss1784-dot/kisshug.git gh-pages
```
