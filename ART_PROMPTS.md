# ART_PROMPTS.md — 本番キャラ画像の作り方（FUMIO 向け）

ChatGPT の画像生成でキャラ画像を作り、**所定のフォルダに置くだけ**でゲームに反映されます（コード変更不要。`npm run build` で `scripts/art-manifest.mjs` が自動検出）。画像が無いスロットは、ゲームが自前で描く「ぬいぐるみ風」のベクター絵で代替されるので、1 枚ずつ差し替えて確認できます。

## 1. 置き場所とファイル名（スロット）

```
assets/characters/
  cat/      idle.png happy.png kiss_give.png kiss_receive.png hug_give.png hug_receive.png handshake.png face.png  anchors.json
  dog/      （同じ）
  rabbit/   （同じ）
  bear/     （同じ）
  photo/    idle.png … handshake.png   ← 頭が空白の丸になった体（写真モード用）。face.png は不要  anchors.json
```

| スロット | 内容 | サイズ |
|---|---|---|
| `idle` | 正面やや右向きで立つ。待機（呼吸・まばたきはプログラム側） | 600×600 |
| `happy` | 両手を上げて喜ぶ。口を開けた笑顔 | 600×600 |
| `kiss_give` | 右（相手側）に少し身を乗り出し、口をすぼめてチュッ。片目ウインク | 600×600 |
| `kiss_receive` | 少し後ろにのけぞり、目を閉じて照れる（頬の赤みはプログラムでも重ねる） | 600×600 |
| `hug_give` | 両腕を前（右）に広げて抱きしめにいく | 600×600 |
| `hug_receive` | 腕を軽く広げ、目を閉じてうれしそう | 600×600 |
| `handshake` | 右手を前に水平に出す。少し前傾 | 600×600 |
| `face` | 顔のアップ（盤面の駒・選択カード用）。顔が枠いっぱい | 256×256 |

- 形式: **PNG（透過）または WebP（透過）**。両方あれば WebP を優先。
- **キャラは全員右向き**（相手が右にいる前提）。左側に立つときはプログラムが左右反転します。
- **足元の位置を全ポーズ・全キャラで揃える**: 600×600 の中で足裏の中心が **(300, 560)**。キャラの高さは頭のてっぺん（耳含まず）が y≈65 くらい、つまり約 500px。これがずれると演出中にキャラが上下にガタつきます。
- 合計 3MB 以下（`npm run build` 時に自動チェック。超えるとビルドが止まります）。1 枚 60〜120KB 目安。WebP 推奨。

## 2. スタイル指定（共通プロンプト）

```
A plush toy style 3D render of a cute chibi {ANIMAL} mascot, round soft body, short stubby arms and legs,
oversized head, big glossy eyes with bright highlights, rosy blush on the cheeks, {COLOR} fur,
{ANIMAL_FEATURES}, soft studio lighting, subtle fabric texture, full body, standing, facing slightly to the right,
feet at the bottom center, centered composition, plain pure white background, no text, no shadow on the floor,
square 1:1 image
```

| キャラ | `{ANIMAL}` | `{COLOR}` | `{ANIMAL_FEATURES}` |
|---|---|---|---|
| ねこ モモ | cat | cream with light orange | pointed triangular ears with pink inner ears, a long curled tail with an orange tip |
| いぬ コロ | dog | light brown | floppy drooping ears, a short wagging tail |
| うさぎ ミミ | rabbit | white with pink | long upright ears with pink inner ears, a round cotton tail |
| くま クマオ | bear | warm brown | small round ears with lighter inner ears, a tiny round tail |

写真モード用の体（`photo/`）:
```
A plush toy style 3D render of a cute chibi mascot body in pastel pink fabric, round soft body, short stubby arms and legs,
with a completely blank smooth flat round head (no face, no ears, no hair, just a plain sphere), full body, standing,
facing slightly to the right, feet at the bottom center, plain pure white background, no text, square 1:1 image
```
体の色はプログラム側で乗算して変えるので、**白〜ごく薄いピンク**で作ると 4 色（ピンク／ミント／ラベンダー／レモン）がきれいに出ます。

## 3. ポーズ別プロンプト（共通プロンプトの後ろに足す）

| スロット | 追加プロンプト |
|---|---|
| idle | `standing still with arms relaxed at the sides, gentle smile` |
| happy | `both arms raised up in joy, mouth open in a big happy smile, slightly bouncing` |
| kiss_give | `leaning forward to the right, puckered lips giving a kiss, one eye winking, arms slightly back` |
| kiss_receive | `leaning slightly back, eyes closed, shy happy smile, strong blush, arms raised a little in surprise` |
| hug_give | `both arms open wide reaching forward to the right for a hug, eyes closed, big smile` |
| hug_receive | `arms gently open, eyes closed, happy relaxed smile, blushing` |
| handshake | `right arm extended straight forward to the right for a handshake, friendly smile, slight lean forward` |
| face | `close-up of the face only, head fills the frame, looking at the camera, gentle smile` |

## 4. 同一キャラで全ポーズを揃える手順

1. まず `idle` を作り、気に入ったものを **参照画像** として保存する。
2. 以降のポーズは、その参照画像を添付して「**この同じキャラクターを、同じスタイル・同じ色・同じプロポーションで、次のポーズにしてください: …**」と頼む（ChatGPT の画像編集／参照機能）。毛色・目の形・耳の形が変わったらやり直す。
3. 1 キャラ 8 枚（face 含む）× 4 キャラ ＋ 写真用 7 枚 = 39 枚。
4. 迷ったら、ゲーム内のフォールバック絵（`npm run dev` で起動）を参照画像にして「この絵をぬいぐるみ風 3D にして」と頼むと、シルエットと足元が揃いやすい。

## 5. 白背景を透過にする

- 生成画像は白背景なので、以下のいずれかで透過 PNG にする:
  - macOS プレビュー: 「インスタントアルファ」で白を選択 → 削除 → PNG で書き出し
  - remove.bg などの背景除去サービス、または Photoshop「背景を削除」
  - 白ふちが残る場合は、1〜2px 縮小（Photoshop: 選択範囲 → 縮小）してから書き出す
- 書き出しサイズは 600×600（face は 256×256）。足元を (300, 560) に合わせる（下の手順）。

## 6. 足元位置の揃え方（重要）

1. 600×600 のキャンバスを用意し、ガイド線を y=560（足裏）と x=300（中心）に引く。
2. 各ポーズのキャラを、**足裏の中心がガイドの交点**に来るように配置する。身長は約 500px（頭頂 y≈65）に揃える。ジャンプ系のポーズでも足元は 560 に置く（跳ねはプログラムがやる）。
3. 顔の円の中心と半径、額の位置、目・頬の位置を **`anchors.json`** に書く（ポーズごと）。
   - `head`: 顔の円（写真モードではここに顔写真を貼る。`photo/anchors.json`）
   - `forehead`: クラシックモードで ✗/◯ バッジを置く位置
   - `eyes`: 2 点（まばたきのまぶたを重ねる）、`eyeWidth`: 目の幅、`eyelid`: まぶたの色（体の色）
   - `cheeks`: 2 点（頬の赤みを重ねる）
   - `top`: ハート・キラキラが湧く位置（頭のてっぺん）
   - 現在の値はフォールバック絵に合わせた既定値。差し替え後に `npm run dev` で演出を見ながら数値を調整する。
4. `npm run build` → `art manifest: N image slots, X KB` と出れば認識されている。

## 7. 確認

- `npm run dev` → キャラ選択で顔、対局で待機、結果で演出を確認。
- `npm run test:e2e` で容量（3MB／5MB）と外部通信ゼロが自動チェックされる。
- サムネイル（審査提出用）は `node scripts/gen-thumbnails.mjs` で再生成（タイトル画面の顔 4 つ、文字なし）。
