# LAB-1

ブラウザの減算合成グルーヴボックス。音は Tone.js の**低レベルプリミティブだけ**
(`Oscillator` / `Noise` / `Filter` / `AmplitudeEnvelope` / `FrequencyEnvelope` /
`WaveShaper` / `Delay` / `LFO` …)から作ります。`MembraneSynth` などの完成品シンセや
`Tone.Reverb` などの完成品エフェクトは使わず、「プリミティブから音とエフェクトを組み立てる」
ことを読めるコードで示すのが狙いです。

2 つのタブで構成します。

- **SOUND** — 単体の音作り。1 つの声(モノシンセ + FX)を設計してプリセットとして保存する。
- **PATTERN** — 作ったプリセットを各トラックに割り当て、16 ステップで組むリズムシーケンサー。

もとの仕様/設計メモは [`docs/`](docs/) を参照(その後プリセット駆動モデルへ発展)。

## SOUND タブ(3 カラム)

- **左**: プリセットの保存 / 読込 / 削除 / JSON 入出力。808 系サウンドをファクトリープリセットとして同梱(削除不可)
- **中央**: オシロスコープ + キーボード(オクターブ切替、PC キー `Z`/`X`)
- **右**: 波形選択・フィルタ種別(LP/HP/BP)・音作りノブ・FX ラック

音作りの要点:

- **ピッチエンベロープ**(P.AMT / P.TIME): 発音瞬間に `音程 × N` から音程へ急降下 → キック/タムの胴鳴り。`x1` で通常のメロディ演奏
- **ノイズ源 + HP/BP フィルタ**: スネア/ハット/クラップ
- **フィルターエンベロープ + ADSR**: SUSTAIN=0 でワンショット(打楽器)
- **FX(すべてプリミティブ自作)**: Drive(WaveShaper)/ Auto-wah(Filter+LFO)/ Delay(Delay+フィードバック)/ Reverb(Delay によるコムフィルタ網)

## PATTERN タブ

- 各トラックに SOUND プリセットを割り当て(ドロップダウン)。トラックごとにチューン(Hz)・ミュート・試聴・削除、トラック追加
- 16 ステップ × 可変トラック。BPM / スウィング、再生中編集
- タイミングは Tone.Transport の look-ahead スケジューリングのみ(`setTimeout`/`rAF` に依存しない)。プレイヘッドは `Tone.Draw` で音声時刻に同期
- パターンは各トラックにプリセットのスナップショットを埋め込む自己完結データ(JSON 入出力可)

## アーキテクチャ

エンジン層は React 非依存の純粋 TypeScript。UI からはパラメータ設定とトリガーだけを呼ぶ。

```
UI (React)  ─ setParam / trigger / loadPreset ─▶  Engine
                                     ├ SoundEngine       (SOUND: 設計中の 1 ボイス、モノシンセ + FxChain)
                                     ├ PatternEngine      (PATTERN: プリセット駆動トラック = SoundEngine × N)
                                     └ Sequencer          (Tone.Transport)
Persistence  StorageAdapter(ArtifactStorage / LocalStorage)＋ Serializer(検証つき JSON I/O)
             SoundPresetStore / PatternStore（共有インデックス）
MasterBus:  Gain ─▶ Analyser(オシロ共用) ─▶ Volume ─▶ WaveShaper(安全用ソフトクリップ) ─▶ Destination
```

`noteOn(freq, time, velocity)` / `trigger(track, vel, time)` が時刻引数を持つため、
キーボード/試聴(`time = now`)とシーケンサー(Transport の未来時刻)が同じ経路を共有します。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm test           # ユニットテスト(検証 / プリセット・パターン往復 / ストア CRUD)
npm run typecheck
```

### テストについて

- ロジック系(スキーマ検証・プリセット/パターン往復・ストア CRUD・ノブ写像)は node 上で実行。
- 音源の波形特性テスト(ピッチ掃引・フィルタ種別・シーケンサーの等間隔性)は Web Audio の
  `OfflineAudioContext` を必要とし、node では**明示的にスキップ**されます。ブラウザ環境で実行するには
  `npx vitest --browser`。

## 依存

ランタイム依存は **React + Tone.js のみ**。

## ライセンス

MIT
