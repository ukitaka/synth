# LAB-1 設計書

- ドキュメント種別: 基本設計 + 音源/エフェクト詳細設計
- 対応要件: `requirements.md` v2.0
- ステータス: v2.0(実装済みの現行設計を反映)
- 作成日: 2026-07-12 / 改訂日: 2026-07-13

---

## 0. 改訂履歴

| 版 | 内容 |
|---|---|
| v1.0 | DRUM モード(固定 6 ボイス: KickVoice/SnareVoice/HatVoice/ClapVoice/TomVoice + DrumEngine + KitStore) |
| v2.0 | プリセット駆動へ再構成。固定ボイス群を撤去し、`SoundEngine`(汎用モノシンセ)を唯一の音源クラスとする。808 音色はファクトリープリセットとして再現。`PatternEngine`(トラックごとに SoundEngine を保持)+ Pattern スキーマ v2。FX チェーン(全てプリミティブ自作)を追加 |

---

## 1. 全体アーキテクチャ

3 層に分離する。エンジン層は React に依存しない純粋な TypeScript クラス群とし、
UI からはパラメータ設定とトリガーだけを呼ぶ(NFR-04, NFR-08)。

```
┌────────────────────────────── UI 層 (React) ──────────────────────────────┐
│  ModeSwitch │ SoundPanel(3カラム)            │ PatternPanel               │
│             │  PresetControls│Scope+Keys│Knobs+FX │ Transport+TrackRows   │
└───────────────┬──────────────────────────────────┬────────────────────────┘
                │ setParam / noteOn / loadPreset    │ save / load / export
┌───────────────▼──────────────────┐   ┌───────────▼───────────────────────┐
│            エンジン層             │   │           永続化層                 │
│  SoundEngine (SOUND の 1 ボイス)  │   │  StorageAdapter (interface)       │
│   └ FxChain: Drive→Wah→Delay→Rev │   │   ├ ArtifactStorage(window.storage)│
│  PatternEngine                   │   │   ├ LocalStorage                   │
│   └ SoundEngine × N (トラック)    │   │   └ MemoryStorage(テスト/フォール │
│  Sequencer (Tone.Transport)      │   │      バック)                       │
│                                  │   │  Serializer (JSON I/O + 検証)      │
│                                  │   │  SoundPresetStore / PatternStore   │
└───────────────┬──────────────────┘   └───────────────────────────────────┘
                ▼
   MasterBus: Gain ─┬─► Analyser(オシロ共用)
                    └─► Volume ─► WaveShaper(tanh ソフトクリップ) ─► Destination
```

### 1.1 タブ共存(FR-11x)

- `MasterBus` を最初に生成し、SOUND の `SoundEngine` と PATTERN の `PatternEngine` は双方ここへ接続する。オシロスコープ用 Analyser はマスターバス上(プリフェーダー)に置くため、どちらのタブでも波形が出る。
- タブ切替は UI 表示の切替のみ。切替時に出て行く側の `releaseAll()`(PATTERN 再生中なら `sequencer.stop()` も)を呼ぶ(FR-111)。
- マスター最終段の `WaveShaper(tanh)` は安全用ソフトクリップ。tanh は |y|<1 を数学的に保証するため、複数トラック同時発音でもハードクリップしない(NFR-09)。Analyser はソフトクリップより前をタップするので、オシロには合成した素の波形が映る(G1)。

---

## 2. SoundEngine(音源詳細設計)

唯一の音源クラス。SOUND タブの設計対象であり、PATTERN の各トラックの実体でもある。

```
Osc(wave) ──► oscGain(1-noise) ──┐
Noise(white) ─► noiseGain(noise) ─┴─► Filter(LP/HP/BP, Q=reso) ─► AmpEnv(ADSR) ─► out(0.7)
                                                                                    │
PitchEnv:  note×pitchAmt → note (decay=pitchTime, exp)  ──► Osc.frequency          ▼
FilterEnv: cutoff → cutoff×2^filterEnv (decay=AmpEnv.decay) ─► Filter.frequency   FxChain ─► Bus
```

設計上の要点:

- **ピッチエンベロープはトリガー音程に相対**。`noteOn(freq)` のたびに `baseFrequency = freq`、`octaves = log2(pitchAmt)` を設定する。`pitchAmt=1` で掃引なし(通常演奏)、上げるとキック/タムの胴鳴りになる。
- オシレーター/ノイズは常時走らせ、AmpEnv でゲートする(リトリガーはクリックなくエンベロープ再アタック)。
- フィルタエンベロープの decay は AmpEnv の decay に追従させる(ノブ 1 つで音の長さが揃う)。
- パラメータ一覧・値域は `synthSpecs.ts`(`SYNTH_SPECS`)が単一情報源。UI のノブ生成・Serializer の検証・テストがすべてここを参照する。
- プリセット化: `toPreset(name)` / `loadPreset(p)`。対象は 波形 / フィルタ種別 / 全パラメータ / FX の ON+パラメータ(§6.1)。

## 3. FxChain(エフェクト詳細設計)

SOUND のボイス出力に直列で挿す(FR-216)。全ユニットが共通基底 `FxNode` を持つ。

```
FxNode(共通):  input ─┬─► dry(1-wet) ─────────────► output
                      └─► [ユニット固有の処理] ─► wet ─► output
```

- ON/OFF はバイパス(wet を 0 へ 20ms ランプ)。MIX 値は保持され、再 ON で復元。
- 各ユニットのパラメータ定義は `fxSpecs.ts`(`FX_DEFS`)が単一情報源。

### 3.1 DRIVE

```
input ─► WaveShaper( tanh(k·x)/tanh(k) ) ─► makeup Gain ─► wet     k = drive (1–20)
```

### 3.2 AUTO-WAH

```
LFO(rate, sine) ─► Filter.frequency (base .. base×2^depth)
input ─► Filter(bandpass, Q6) ─► wet
```

### 3.3 DELAY

```
input ─► Delay(time) ─┬─► wet
          ▲           └─► LPF(4kHz 固定) ─► feedback Gain(≤0.95) ─┐
          └───────────────────────────────────────────────────────┘
```

フィードバック経路のダンピング LPF でリピートが自然に暗くなる。feedback は 1 未満にクランプし必ず減衰する。

### 3.4 REVERB(Schroeder 系簡易実装)

```
input ─► [ comb × 6 並列 ] ─► sum(1/6) ─► wet
   comb: Delay(t_i) ─┬─► sum
                     └─► LPF(damp) ─► fb Gain(size) ─► Delay へ戻す
   t_i = 29.7 / 37.1 / 41.1 / 43.7 / 5.0 / 1.7 ms(互いに素に近い値で反射を散らす)
```

---

## 4. ファクトリープリセット

808 系の音色は SoundEngine のレシピとして `factoryPresets.ts` に定義する(コード内定数、
storage には保存しない = 削除・上書き不可を自然に満たす。FR-312)。

| 名前 | 波形 | Filter | 要点 | 推奨ノート | choke |
|---|---|---|---|---|---|
| Kick | sine | LP | pitchAmt 6 / pitchTime 50ms / sustain 0 / decay 0.35 | 55Hz | — |
| Tom | sine | LP | pitchAmt 2(浅い下降)/ decay 0.35 | 110Hz | — |
| Snare | triangle | BP 1.8kHz | noise 0.6(胴+響き線ミックス) | 200Hz | — |
| Closed Hat | square | HP 8kHz | noise 1 / decay 45ms | 300Hz | hat |
| Open Hat | square | HP 8kHz | noise 1 / decay 400ms | 300Hz | hat |
| Clap | sawtooth | BP 1.2kHz | noise 1 / decay 0.2 | 300Hz | — |
| Zap | sine | LP | pitchAmt 8 / pitchTime 150ms(レーザー系) | 220Hz | — |
| Bass | sawtooth | LP 800Hz | filterEnv 2oct / sustain 0.7(旋律用) | 55Hz | — |

推奨ノートとチョークグループは `FACTORY_META` に持ち、PATTERN トラックへの割当時に適用する。

> v1.0 の専用回路(矩形波 6 基のハット等)は撤去した。ハット/クラップは単一オシレーター+
> ノイズでの近似となり質感は簡素化されるが、「作った音がそのままトラックに載る」統一モデルを優先した。

---

## 5. PatternEngine + Sequencer

### 5.1 PatternEngine

```ts
class PatternEngine {
  // トラック = { sound: SoundEngine, note: number, chokeGroup?: string, mute: boolean }
  sync(pattern: Pattern): void;      // パターンのトラック列と実ボイスを整合させる
  trigger(i: number, velocity?: number, time?: number): void;  // チョーク処理込み
  preview(i: number): void;          // ミュート無視の試聴
  releaseAll(time?: number): void;
}
```

- トラックごとに `SoundEngine` を 1 基持ち、埋め込みプリセットを `loadPreset` で流し込む。
- `sync()` は構造変更時のみ呼ぶ(トラック追加/削除・プリセット差替・チューン/ミュート変更)。
  ステップの ON/OFF はパターンオブジェクトの書き換えだけで済む(再生コールバックが毎ステップ現在値を読む。FR-417)。
- チョーク(FR-413): `trigger(i)` 時に同じ `chokeGroup` の他トラックへ `noteOff(time)`。

### 5.2 Sequencer

```ts
start() {
  transport.bpm.value = pattern.bpm;
  transport.swing = pattern.swing;           // 16分裏に適用
  transport.swingSubdivision = "16n";
  eventId = transport.scheduleRepeat((time) => {
    pattern.tracks.forEach((track, i) => {
      const vel = track.steps[step];
      if (vel > 0) engine.trigger(i, vel, time);   // 未来時刻を透過
    });
    Tone.getDraw().schedule(() => onStep(step), time);  // UI 更新は Draw 経由
  }, "16n");
  transport.start();
}
```

- 発音時刻の根拠は Transport の look-ahead のみ(NFR-02)。プレイヘッドは `Tone.Draw` で音声時刻に同期し、UI から発音タイミングを決めない。
- 鍵盤/試聴(`time = now`)とシーケンサー(未来時刻)は同じ `noteOn(freq, time, velocity)` / `trigger(i, vel, time)` を通る。

---

## 6. データモデル(JSON スキーマ)

### 6.1 SoundPreset(`lab1.sound` v1)

```json
{
  "schema": "lab1.sound",
  "version": 1,
  "name": "My Kick",
  "waveform": "sine",
  "filterType": "lowpass",
  "params": { "pitchAmt": 6, "pitchTime": 0.05, "noise": 0, "cutoff": 8000,
              "reso": 2, "filterEnv": 0, "attack": 0.002, "decay": 0.35,
              "sustain": 0, "release": 0.05 },
  "fx": {
    "drive":  { "on": false, "params": { "drive": 4, "mix": 1 } },
    "wah":    { "on": false, "params": { "rate": 2, "depth": 3, "base": 400, "mix": 0.6 } },
    "delay":  { "on": false, "params": { "time": 0.3, "feedback": 0.35, "mix": 0.3 } },
    "reverb": { "on": false, "params": { "size": 0.7, "damp": 3000, "mix": 0.3 } }
  }
}
```

### 6.2 Pattern(`lab1.pattern` v2)

```json
{
  "schema": "lab1.pattern",
  "version": 2,
  "name": "Basic House",
  "bpm": 122,
  "swing": 0,
  "length": 16,
  "tracks": [
    {
      "preset": { "schema": "lab1.sound", "version": 1, "name": "Kick", "...": "..." },
      "note": 55,
      "chokeGroup": null,
      "mute": false,
      "steps": [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
    }
  ]
}
```

- ステップ値は 0(OFF)または 0–1 のベロシティ(現行 UI のトグルは 0/1)。
- **トラックはプリセットのスナップショットを埋め込む**(FR-419)。パターン JSON は単体で完全再生できる。
- インポート検証(FR-314): `schema` / `version` の一致 → 各値を仕様の min/max と照合し、範囲逸脱はキー名と許容範囲付きのエラーで拒否。埋め込みプリセットも同じ検証を通す。

---

## 7. 永続化層

```ts
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

- 実装は `ArtifactStorage`(window.storage、キー不存在時の throw を null に正規化)/ `LocalStorage` / `MemoryStorage`(テスト・フォールバック)。起動時に環境検出して注入(NFR-06)。
- キー設計: `drumlab:sound:{uuid}` / `drumlab:pattern:{uuid}` / `drumlab:index`
  (index に {id, name, type: "sound"|"pattern", updatedAt} の一覧を保持し、一覧表示は index のみ読む。両ストアで共有)。
- 同名保存は上書き(同じ uuid を再利用)。ファクトリー名への保存・ファクトリーの削除は例外を投げる。

---

## 8. UI 設計

### 8.1 SOUND タブ(3 カラム)

```
┌────────────────────────────────────────────────────────────────────┐
│ LAB-1                                  [SOUND|PATTERN]   ● POWER  │
├──────────────┬───────────────────────────┬─────────────────────────┤
│ [name][保存] │ ▒▒▒ オシロスコープ ▒▒▒    │ [saw][sq][tri][sin]     │
│ ★ Kick      │                           │ FILTER [LP][HP][BP]     │
│ ★ Tom       │ OCT [−] +0 [+]            │ (P.AMT)(P.TIME)(NOISE)… │
│ ★ Snare     │ ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐    │ (ATTACK)(DECAY)…        │
│ …           │ │ 鍵盤(1oct+C)         │    │ ┌ DRIVE ────────────┐  │
│ [書出][読込] │ └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘    │ │ ● (DRIVE)(MIX)     │  │
│ [削除]       │                           │ └────────────────────┘  │
│              │                           │ AUTO-WAH / DELAY / REV │
└──────────────┴───────────────────────────┴─────────────────────────┘
   190px              1fr                        380px
```

- ノブ列は `SYNTH_SPECS` / `FX_DEFS` を map してレンダリング(パラメータ追加時に UI 改修不要)。
- プリセット読込はエンジンへ `loadPreset` + UI state 再同期の両方を行う(FR-311)。
- モバイル(≤820px)ではカラムを縦積みに折り返す(NFR-05)。

### 8.2 PATTERN タブ

```
┌────────────────────────────────────────────────────────────────────┐
│ ▒▒▒ オシロスコープ ▒▒▒                                            │
│ PTN [★Basic House▼][name][保存][書出][読込][削除]                 │
│ [▶ PLAY]  BPM [122]  SWING ────────○ 0%                           │
│ ┌ Kick ▼ │55Hz│M│♪│× ┐  ■□□□■□□□■□□□■□□□  ← 16 ステップ       │
│ ┌ Snare ▼│200 │M│♪│× ┐  □□□□■□□□□□□□■□□□                       │
│ …                                                                  │
│ [＋ トラック追加]                                                  │
└────────────────────────────────────────────────────────────────────┘
```

- プレイヘッドは再生中のステップセルに枠を付ける(FR-416)。
- ステップ編集は非構造変更(パターン書換のみ)、それ以外(プリセット差替・チューン・ミュート・追加/削除)は `PatternEngine.sync()` を伴う。

### 8.3 PC キー割当

| コンテキスト | キー | 動作 |
|---|---|---|
| SOUND | A W S E D F T G Y H U J K | 演奏(C4–C5) |
| SOUND | Z / X | オクターブ − / + |

---

## 9. テスト戦略

エンジンは UI を介さず直接検証する(NFR-08)。2 系統に分ける。

1. **node で実走(決定的ロジック)**: Serializer の検証(スキーマ/値域/エラーメッセージ)、
   プリセット/パターンの往復、ストア CRUD(ファクトリー不変・同名上書き・共有 index の非破壊)、
   ノブ写像(lin/log の往復)。
2. **ブラウザ実行(波形特性、`OfflineAudioContext` 必須)**: `test/helpers/audioEnv.ts` が実レンダを試して
   可否判定し、node では**明示スキップ**する。`npx vitest --browser` で実行。
   - キックプリセットのピッチ下降(早期 ZCR > 後期 ZCR)
   - HP+noise が LP+noise より明るい(フィルタ種別)
   - PatternEngine がトラックのプリセットで発音する
   - シーケンサーの 4 つ打ちが等間隔(オンセット間隔の偏差 < 30ms)

### 9.1 ブラウザでの手動検証手法(開発メモ)

- dev 中は `window.__lab = system`(DEV 限定・検証後に削除)を仕込み、`__lab.sound` / `__lab.master.getWaveform()` を直接計測する。
- Analyser には ~50ms のラグがある。リアルタイムで音程を推定する場合は、ピークが立った単一フレームの立ち上がりエッジ数 × sampleRate/1024 を使う。
- プレイヘッドは Tone.Draw(rAF)依存のため、バックグラウンドタブでは更新が止まる(音は鳴り続ける)。

---

## 10. 既知の制約・リスク

| 項目 | 内容 | 対応 |
|---|---|---|
| ノイズ系プリセットの音量 | Snare/Clap は BP フィルタ通過後のエネルギーが小さく、Kick 等よりピークが低い | 必要ならプリセットの mix/レベル調整。トラック個別レベルは将来課題 |
| ハットの質感 | v1 の矩形波 6 基合算に比べ簡素(単一 OSC + ノイズ近似) | 統一モデルの利点を優先。金属感が欲しければ SOUND で作り込む余地を残す |
| 同時発音数 | トラック数ぶんの SoundEngine が常駐(各 OSC+Noise 常時走行) | 現実的なトラック数(〜10)では問題なし。増えたら要計測 |
| ベロシティ入力 | ステップ値は 0–1 対応だが UI は 0/1 トグルのみ | アクセント入力 UI は将来課題 |
| Transport.swing の効き方 | 想定とズレる可能性 | 実測で確認。合わなければ scheduleRepeat 内で裏拍に手動オフセット(インターフェース不変) |
