# LAB-1 — DRUM

ブラウザ減算シンセ **LAB-1** の DRUM モード。TR-808 系のドラム音を、Tone.js の
**低レベルプリミティブだけ**(`Oscillator` / `Noise` / `Filter` / `AmplitudeEnvelope` /
`FrequencyEnvelope` / `WaveShaper` …)から合成します。`MembraneSynth` などの完成品シンセ
クラスは使いません。「プリミティブから 808 を組み立てる」ことを読めるコードで示すのが狙いです。

仕様と設計は [`docs/requirements.md`](docs/requirements.md) / [`docs/design.md`](docs/design.md) を参照。

## 特徴

- **6 ボイス**: BD(キック)/ SD(スネア)/ CH・OH(ハイハット)/ CP(クラップ)/ LT(ロータム)
- 各ボイス = 1 クラス。信号経路をコンストラクタに **flow 順で記述**し経路コメントを付す(回路図が読めるコード)
- CH / OH の **チョークグループ**(実機ハイハット挙動)
- `ParamSpec` 駆動の UI。ノブ列は選択ボイスの spec から自動生成(ボイス追加時に UI 改修不要)
- **キット**(6 ボイスの音色一式)の保存 / 読込 / 削除 / JSON 入出力。ファクトリーキット同梱・削除不可
- **16 ステップ × 6 トラック シーケンサー**(Phase 2): BPM / スウィング、再生中編集、
  Transport の look-ahead スケジューリングによる正確なタイミング(`setTimeout`/`rAF` に依存しない)
- **SYNTH モード = ドラム音作りもできるモノシンセ**: ピッチエンベロープ(胴鳴り)/ ノイズ源 /
  フィルターエンベロープ / ADSR + オクターブ切替。`x1` で通常のメロディ演奏、上げると 808 的な胴鳴り
- **FX(SYNTH 専用、すべてプリミティブ自作)**: Drive(WaveShaper)/ Delay(Delay+フィードバック)/
  Reverb(Delay によるコムフィルタ網)/ Auto-wah(Filter+LFO)
- SYNTH / DRUM のモード切替。マスター出力とオシロスコープは共用

## アーキテクチャ

エンジン層は React 非依存の純粋 TypeScript。UI からはパラメータ設定とトリガーだけを呼ぶ。

```
UI (React)  ──setParam / trigger──▶  Engine
                                     ├ DrumEngine ─┬ KickVoice(BD) / TomVoice(LT)
                                     │             ├ SnareVoice(SD)
                                     │             ├ HatVoice(CH/OH)
                                     │             └ ClapVoice(CP)
                                     ├ Sequencer (Tone.Transport, Phase 2)
                                     └ SynthEngine (SYNTH モード)
Persistence  StorageAdapter(ArtifactStorage / LocalStorage)＋ Serializer(検証つき JSON I/O)
MasterBus:  Gain ─▶ Analyser(オシロ) ─▶ Volume ─▶ WaveShaper(安全用ソフトクリップ) ─▶ Destination
```

`trigger(id, velocity, time)` が時刻引数を持つため、パッド演奏(`time = now`)と
シーケンサー(Transport の未来時刻)が同じ経路を共有します。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm test           # ユニットテスト(検証 / チョーク / 往復 / ストア)
npm run typecheck
```

### テストについて

- ロジック系(スキーマ検証・チョーク選択・キット/パターン往復・ストア CRUD)は node 上で実行。
- 音源の波形特性テスト(§9.1 / §9.2 / §9.4)は Web Audio の `OfflineAudioContext` を必要とし、
  node では**明示的にスキップ**されます。ブラウザ環境で実行するには `npx vitest --browser`。

## 依存

ランタイム依存は **React + Tone.js のみ**(NFR-07)。

## ライセンス

MIT
