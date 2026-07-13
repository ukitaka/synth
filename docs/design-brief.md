# LAB-1 ビジュアルデザイン改善 指示書

- ドキュメント種別: デザイン指示書(Claude Design 向け)
- 対象: LAB-1 の UI 全体(SOUND / PATTERN 両タブ)
- 前提資料: `requirements.md` v2.0 / `design.md` v2.0
- 作成日: 2026-07-13
- ステータス: **実装済み**(Claude Design の確定案「LAB-1 Console 1b」を実装。2026-07-13)

---

## 0. 実装メモ

Claude Design プロジェクト(`design/p/7f219d87-...`、ファイル `LAB-1 Console 1b.dc.html`)の
確定案をそのまま `src/styles.css` 全面刷新 + 各コンポーネントの最小限の構造追加で実装した。

- **フォント**: IBM Plex Mono(OFL)を `@fontsource/ibm-plex-mono` から 400/500/600/700 の
  woff2 のみ抽出し `src/assets/fonts/` に同梱(ランタイム npm 依存には追加していない)。
- **トークン**: `--bg/--chassis/--plate/--btn/--well/--accent/--led/--ink/--muted` に刷新。
- **ノブ**: SVG のティックリング + 値アーク(stroke-dasharray)+ メタリックキャップ。
  ドラッグ/ダブルクリック/aria の操作モデルは無変更。ホバー/ドラッグの明度アップは
  `:hover`/`:active` の CSS のみで実現(JS 状態追加なし)。
- **鍵盤**: 白鍵を flex 均等・黒鍵を `position:absolute`(`inset:<keyboard padding>` を基準に
  白鍵と同じボックスへ重ねる)で再実装。
- **FX チェーン表示・状態ラベル・ステップ定規・STEP n/16 表示**は指示書になかった追加要素。
  デザイン原案の意図(信号経路を読ませる/拍を視覚化する)を汲んで実装時に加えた。
- **モバイル FX アコーディオン**は静的 CSS(`@media` で先頭ユニット以外の `.knob-row` を
  非表示)による簡易実装。タップでの開閉インタラクションは未実装(follow-up 候補)。
- ブラウザ実機検証: プリセット読込→UI/エンジン同期、ノブドラッグ、PATTERN 再生時の
  プレイヘッド(緑グロー)+ ON セル(橙)の重畳表示、POWER on/off の暗転を確認済み。

---

## 1. プロダクトとトーン

LAB-1 は「Tone.js の低レベルプリミティブだけで音とエフェクトを組み立てる」学習用 +
実用のブラウザ・グルーヴボックス。OSS / ポートフォリオとして公開する(G3)。

**目指すトーン: ハードウェア楽器のフロントパネル。**
TR-808 / Teenage Engineering / Elektron のような、密度が高く目的が明確な操作面。
おもちゃっぽさ・Web アプリっぽさ(汎用ボタン・フォーム風 UI)を減らし、
「筐体に印刷されたラベル」「物理ノブ」「LED」の質感に寄せる。
機能は完成しているので、**見た目と手触りのブラッシュアップに専念**してほしい。

---

## 2. 成果物

1. `src/styles.css` の改訂(必要なら CSS カスタムプロパティの再設計を含む)
2. マークアップ変更が必要な場合は各コンポーネント(`src/ui/components/*.tsx`)の
   className / 構造の**最小限の**変更
3. 変更意図の短い説明(何をどういう根拠で変えたか)

デザインモック(HTML 1 枚)を先に作って方向性を確認してから本実装に入る進め方を推奨。

---

## 3. 現状インベントリ

### 3.1 画面構成

- **共通ヘッダー** `.topbar`: ブランド `LAB-1`(`.brand`)/ タブ切替 `.mode-switch > .mode-btn`(SOUND | PATTERN)/ `.power`(● POWER、ON で緑)
- **SOUND タブ** `.sound-tab`(grid: 190px / 1fr / 380px)
  - 左 `.preset-col`: 保存フォーム `.preset-save`、プリセット一覧 `.preset-list > .preset-item`(ファクトリーは ★ 付き)、`.preset-actions`(書出/読込/削除)
  - 中央 `.sound-center`: オシロスコープ `canvas.scope`(緑の波形線)、オクターブ `.octave`、鍵盤 `.keyboard > .pkey(.sharp)`
  - 右 `.sound-controls`: 波形チップ `.select-row > .chip`、FILTER チップ、ノブ列 `.knob-row > .knob`(10 個)、FX ラック `.fx-rack > .fx-unit`(LED `.fx-led` + タイトル + ノブ列)
- **PATTERN タブ** `.pattern-tab`: オシロ、PTN バー `.kit-bar`(select + name + 保存/書出/読込/削除)、トランスポート `.transport`(`.play-btn`、BPM number input、SWING range)、トラック一覧 `.track-list > .track-row`(ヘッダ `.track-head`: preset select / tune input / M / ♪ / × ボタン `.mini`、ステップ列 `.seq-steps > .seq-cell(.beat/.on/.head)`)、`.add-track`

### 3.2 ノブの仕様(重要)

`.knob-dial` は縦ドラッグで値変更(pointer capture、`touch-action: none` 必須)、
ダブルクリックでデフォルト復帰。`.knob-indicator` が `transform: rotate()` で
-135°〜+135° を指す。**この操作モデルと transform による指針表現は変えない**
(見た目のスキンは自由)。

### 3.3 現状のデザイントークン

```css
--bg #1b1d21 / --panel #2a2d33 / --panel-2 #33373e / --ink #e7e9ec /
--muted #9aa0a8 / --accent #ff8a3d(橙) / --accent-2 #7dffb0(緑)
```

### 3.4 既知の負債(片付けてよい)

- v1 の死んだ CSS が残っている: `.voice-editor` `.voice-title` `.pad-grid` `.pad*`
  `.synth-panel` `.synth-head` `.wave-row` `.wave-btn` `.seq-toggle` `.seq-panel`
  `.seq-grid` `.seq-row` `.seq-track`、変数 `--pad` `--pad-sel` → **削除可**
- `.kit-bar` は PATTERN のパターン操作バーとして現役(名前が古いだけ)。リネームする場合は
  `PatternControls.tsx` 側も合わせて変更すること

---

## 4. 改善してほしいポイント(優先順)

1. **視覚階層**: 現状は全要素が同じ「角丸パネル + 1px 黒枠」で並列に見える。
   主役(鍵盤・ステップグリッド)/ 操作(ノブ・チップ)/ 管理(プリセット・保存系)の
   3 層が一目で分かる濃淡・面の設計にする。
2. **ノブ**: 単純な radial-gradient で安っぽい。物理ノブらしい立体感(リング目盛り、
   値に応じたアーク表示など)。ホバー/ドラッグ中の状態表現も。
3. **鍵盤**: 白鍵がフラットな長方形で黒鍵との段差表現がない。実鍵盤らしい
   プロポーション(黒鍵を短く・上に重ねる)と押下状態の表現。flex 折返しで
   黒鍵の位置が崩れることがあるので、レイアウト自体の再設計を歓迎。
4. **ステップグリッド**: 4 分割(1/5/9/13 拍目)の視覚リズムが弱い。`.beat` の区別を強め、
   プレイヘッド(`.head`)は「流れている」感のある表現に。ON セルのベロシティ表現は
   将来課題なので拡張余地を残す。
5. **FX ユニット**: OFF 時 `opacity: .6` だけでは弱い。ハードのモジュールらしい
   ON/OFF(LED + パネルの通電感)。ユニット間の並び(直列チェーン)が分かる表現があると良い。
6. **POWER と起動体験**: POWER OFF 時は `.power-hint` テキストだけ。筐体の電源が
   落ちている(パネル暗転など)表現にし、POWER ON の状態変化に手応えを。
7. **タイポグラフィ**: system-ui 一辺倒。ラベル(TUNE/DECAY 等)は等幅または
   コンデンス系でハードの刻印らしく。数値表示(`.knob-value`)は等幅推奨。
   ※ Web フォントを使う場合はセルフホスト(外部 CDN 不可、§5-4)。
8. **オシロスコープ**: 枠だけの黒箱。CRT/スコープらしい装飾(目盛り、グロー)。
   描画色は `Oscilloscope.tsx` にハードコードされた `#7dffb0` — 変える場合はここも修正。
9. **モバイル(≤820px)**: 現状「縦積みになるだけ」。カラム順・優先度(鍵盤を先に等)を
   設計し、44px タップ領域(NFR-05)を守る。
10. **細部の一貫性**: `保存/書出/読込/削除` ボタン群の質、select/input のネイティブ感の解消、
    フォーカスリング、`.kit-error` エラー表示の設え。

---

## 5. 制約(must)

1. **機能・挙動を変えない**: イベントハンドラ、コンポーネントの props、エンジン層
   (`src/engine/`)には触れない。className の変更は対応する .tsx と同時に。
2. **操作要件**: `touch-action: none` を鍵盤・ノブから外さない。タップ対象は最小 44px
   (モバイル)。`role` / `aria-*`(Knob の slider、タブの tablist 等)は維持または改善。
3. **依存追加なし**: ランタイム依存は React + Tone.js のみ(NFR-07)。CSS フレームワーク・
   アイコンライブラリ・外部 CDN は不可。SVG/CSS 自作は歓迎。
4. **セルフホスト**: フォント含めすべてリポジトリ内で完結させる。
5. **パフォーマンス**: オシロは毎フレーム canvas 再描画。その上に重い blur/shadow を
   常時アニメーションで重ねない。60fps を維持。
6. **ダークテーマ前提**: ライトテーマ対応は不要(将来課題)。
7. **検証**: `npm run typecheck && npm test && npm run build` が通ること。
   SOUND/PATTERN 両タブをブラウザで目視確認(`npm run dev`)。

---

## 6. 参考方向性(拘束ではない)

- Roland TR-808 のパネル(橙/黄/白のアクセント、刻印ラベル、色分けされたステップキー)
- Teenage Engineering OP-1 / EP-133(余白と情報密度のバランス、単色 + 1 アクセント)
- Elektron 系(暗いパネル + LED、グリッドの見せ方)

現在の配色(暗背景 + 橙アクセント + 緑 LED)は 808 的で方向性としては良い。
**捨てて再構築しても、磨き込んでもどちらでも可**。ただしアクセント 2 色
(操作系の橙 / 通電・再生系の緑)の役割分担は守ると全体が締まる。
