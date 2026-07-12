# LAB-1 ドラムモード 設計書

- ドキュメント種別: 基本設計 + 音源詳細設計
- 対応要件: `lab1-drum-mode-requirements.md` v1.0
- ステータス: Draft v1.0
- 作成日: 2026-07-12

---

## 1. 全体アーキテクチャ

3層に分離する。音源エンジンは React に依存しない純粋な TypeScript/JS クラス群とし、
UI からはパラメータ設定とトリガーだけを呼ぶ(NFR-04, NFR-08)。

```
┌────────────────────────── UI 層 (React) ──────────────────────────┐
│  ModeSwitch │ SynthPanel(既存) │ DrumPanel(パッド+ノブ) │ Seq(P2) │
└──────────────┬───────────────────────────┬───────────────────────┘
               │ setParam / trigger        │ save / load / export
┌──────────────▼───────────────┐  ┌────────▼─────────────────────┐
│        エンジン層             │  │        永続化層               │
│  SynthEngine(既存LAB-1音源)  │  │  StorageAdapter (interface)   │
│  DrumEngine                  │  │   ├ ArtifactStorage           │
│   ├ KickVoice   ├ ClapVoice  │  │   │  (window.storage)         │
│   ├ SnareVoice  ├ TomVoice   │  │   └ LocalStorage              │
│   ├ HatVoice(CH)└ HatVoice(OH)│ │  Serializer (JSON I/O+検証)   │
│   └ Sequencer(P2, Transport) │  └──────────────────────────────┘
└──────────────┬───────────────┘
               ▼
   MasterBus: Gain → Analyser(オシロ共用) → Volume → Destination
```

### 1.1 モード共存(FR-010〜012)

- `MasterBus` を最初に生成し、SynthEngine / DrumEngine は双方ここへ接続する。
  オシロスコープ用 Analyser はマスターバス上に置くため、どちらのモードでも波形が出る。
- 両エンジンは電源投入時に常駐生成する(ノード数は少なくメモリ影響は無視できる)。
  モード切替は UI 表示の切替のみで、切替時に `activeEngine.releaseAll()` を呼ぶ。

---

## 2. クラス設計(エンジン層)

```ts
type VoiceId = "BD" | "SD" | "CH" | "OH" | "CP" | "LT";

interface ParamSpec {
  key: string;          // "tune" など
  label: string;        // ノブ表示名 "TUNE"
  min: number; max: number;
  default: number;
  scale: "lin" | "log";
  fmt: (v: number) => string;
}

abstract class DrumVoice {
  abstract readonly id: VoiceId;
  abstract readonly paramSpecs: ParamSpec[];
  readonly chokeGroup?: string;             // "hat" など
  protected out: Tone.Gain;                  // MasterBus へ

  constructor(bus: Tone.Gain) { /* ノード生成と接続(信号経路順に記述) */ }

  abstract trigger(time: number, velocity: number): void;
  choke(time: number): void;                 // env を数msで強制リリース
  setParam(key: string, value: number): void;
  getParams(): Record<string, number>;
  setParams(p: Record<string, number>): void;
  dispose(): void;
}

class DrumEngine {
  voices: Record<VoiceId, DrumVoice>;
  trigger(id: VoiceId, velocity = 1, time = Tone.now()) {
    const v = this.voices[id];
    if (v.chokeGroup) {
      Object.values(this.voices)
        .filter(o => o !== v && o.chokeGroup === v.chokeGroup)
        .forEach(o => o.choke(time));        // FR-022
    }
    v.trigger(time, velocity);               // 連打は voice 内部でリトリガー
  }
  releaseAll(): void;
  toKitJSON(): KitPreset;
  loadKit(kit: KitPreset): void;
}
```

設計意図:

- `trigger(time, ...)` を時刻引数付きにしておくことが Phase 2 の要。パッド演奏は
  `time = Tone.now()`、シーケンサーは Transport が渡す未来時刻をそのまま流すだけで済む(§7)。
- リトリガーは各 Voice 内で `env.triggerAttackRelease` ではなく
  `env.cancel(time); env.triggerAttack(time)` パターンで実装し、クリックノイズを避けるため
  直前に 2ms 程度の強制リリースを挟む。

---

## 3. 各ボイスの合成設計(詳細)

全ボイス共通の約束: ピッチの急降下は `FrequencyEnvelope`(decay は指数カーブ)、
音量は `AmplitudeEnvelope`(sustain=0 のワンショット型)で実現する。

### 3.1 BD — バスドラム

```
Sine Osc ──► FreqEnv(tune×pitchAmt → tune, ~40ms) が周波数を駆動
         └─► AmpEnv(A:1ms, D:decay, S:0) ─► WaveShaper(軽いサチュレーション) ─► Gain ─► Bus
Noise(white) ─► HPF 4kHz ─► AmpEnv(D:8ms) ─► Gain(click量) ─┘   ※クリック成分
```

| パラメータ | 範囲 | 既定 | 説明 |
|---|---|---|---|
| tune | 30–80 Hz | 50 | 着地する基音 |
| pitchAmt | 1.5–6 倍 | 3 | 開始周波数 = tune × pitchAmt |
| decay | 0.1–1.5 s | 0.4 | 胴の鳴りの長さ |
| click | 0–1 | 0.3 | アタックのクリック量 |
| level | -24–+6 dB | 0 | |

サチュレーションは `WaveShaper` の tanh カーブ固定(ノブ化しない。808 の回路歪みの再現)。

### 3.2 SD — スネアドラム

```
Tri Osc 185Hz ─► FreqEnv(×2 → ×1, 30ms) ─► AmpEnv(D:0.12s) ─► Gain(1-snappy) ─┐
Tri Osc 330Hz ─►(同上・浅め)            ─► AmpEnv(D:0.08s) ─► Gain(0.6×同上) ─┼─► Gain ─► Bus
White Noise ─► BPF(1.8kHz, Q2) ─► AmpEnv(D:decay) ─────────► Gain(snappy)    ─┘
```

| パラメータ | 範囲 | 既定 |
|---|---|---|
| tune | 120–280 Hz | 185 |
| snappy(ノイズ比) | 0–1 | 0.5 |
| decay(ノイズ側) | 0.05–0.5 s | 0.18 |
| level | -24–+6 dB | 0 |

胴(2オシレーター)と響き線(ノイズ)の2系統ミックス。808 の SNAPPY ノブに相当。

### 3.3 CH / OH — ハイハット(共通クラス、パラメータ違い)

808 実機と同様、ノイズではなく不協和な矩形波 6 基の合算で金属感を出す。

```
Square×6 (205.3 / 304.4 / 369.6 / 522.7 / 540 / 800 Hz ※808解析値、tuneで一括スケール)
  ─► 合算 Gain ─► BPF(10kHz, Q1) ─► HPF(7kHz) ─► AmpEnv ─► Gain ─► Bus
```

| パラメータ | CH 既定 | OH 既定 | 範囲 |
|---|---|---|---|
| decay | 0.04 s | 0.5 s | 0.02–1.2 s |
| tone(HPF cutoff) | 7 kHz | 7 kHz | 3–10 kHz |
| tune(周波数一括倍率) | 1.0 | 1.0 | 0.8–1.3 |
| level | 0 | 0 | -24–+6 dB |

- chokeGroup = "hat"。choke は AmpEnv を 5ms でリリース。
- CH と OH は同一クラス `HatVoice` の 2 インスタンス(decay 既定値のみ異なる)。
  オシレーター 12 基が常時走るコストを避けたい場合は 6 基を共有バスにして
  CH/OH それぞれの Env+Filter に分岐する最適化を許容する(実装時判断)。

### 3.4 CP — ハンドクラップ

「複数人が手を叩くズレ」を 3 連リトリガー + テールで模す。

```
White Noise ─► BPF(1.1kHz, Q1.5) ─┬► AmpEnv A(3連バースト) ─► Gain ─┬─► Gain ─► Bus
                                  └► AmpEnv B(テール, D:decay) ─► Gain ┘
```

- trigger 時、Env A を t, t+10ms, t+20ms の 3 回リトリガー(各 D:15ms)、
  Env B を t+20ms に 1 回(D:decay)。時刻は全て trigger の time 引数基準で
  スケジュールする(Phase 2 でも正確に鳴る)。

| パラメータ | 範囲 | 既定 |
|---|---|---|
| decay(テール) | 0.1–0.8 s | 0.3 |
| tone(BPF 中心) | 600–2000 Hz | 1100 |
| spread(3連の間隔) | 5–20 ms | 10 |
| level | -24–+6 dB | 0 |

### 3.5 LT — ロータム

BD と同型・パラメータ違い(ピッチ下降が浅く、基音が高い)。`KickVoice` を継承し
既定値と paramSpecs だけ差し替える。

| パラメータ | 範囲 | 既定 |
|---|---|---|
| tune | 60–200 Hz | 95 |
| pitchAmt | 1.2–3 倍 | 1.6 |
| decay | 0.1–1.0 s | 0.35 |
| level | -24–+6 dB | 0 |

---

## 4. UI 設計(Phase 1)

DRUM モード時のパネル構成。LAB-1 の筐体・配色・Knob コンポーネントを流用する。

```
┌─────────────────────────────────────────┐
│ LAB-1        [SYNTH|DRUM]      ● POWER │
├─────────────────────────────────────────┤
│ ▒▒▒▒▒▒ オシロスコープ(共用) ▒▒▒▒▒▒▒▒ │
├─────────────────────────────────────────┤
│ KIT: [808風▼] [保存] [書出] [読込]     │
├─────────────────────────────────────────┤
│ 選択ボイス: BD                          │
│  (TUNE) (PITCH) (DECAY) (CLICK) (LEVEL) │ ← paramSpecs から自動生成
├─────────────────────────────────────────┤
│ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐   │
│ │ BD ││ SD ││ CH ││ OH ││ CP ││ LT │   │ ← パッド(タップ=発音+選択)
│ └────┘└────┘└────┘└────┘└────┘└────┘   │
└─────────────────────────────────────────┘
```

- ノブ列は選択ボイスの `paramSpecs` を map してレンダリングする(ボイス追加時に UI 改修不要)。
- パッドは `onPointerDown` で発音。長押しや上下ドラッグは割り当てない(誤爆防止)。
- PC キー割り当て: `Z X C V B N` = BD SD CH OH CP LT。
- モバイル: パッドは 2 行 3 列に折り返し、最小 52px 四方(NFR-05)。

---

## 5. 永続化層

```ts
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

- 実装は `ArtifactStorage`(window.storage、キー不存在時の throw を null に正規化)と
  `LocalStorage` の 2 つ。起動時に環境検出して注入(NFR-06)。
- キー設計: `drumlab:kit:{uuid}` / `drumlab:pattern:{uuid}` / `drumlab:index`
  (index に {id, name, type, updatedAt} の一覧を保持し、一覧表示は index のみ読む)。
- ファクトリーキットはコード内定数とし、storage には保存しない(FR-042 の削除不可を自然に満たす)。

---

## 6. データモデル(JSON スキーマ)

### 6.1 KitPreset

```json
{
  "schema": "lab1.kit",
  "version": 1,
  "name": "My 808",
  "voices": {
    "BD": { "tune": 50, "pitchAmt": 3, "decay": 0.4, "click": 0.3, "level": 0 },
    "SD": { "tune": 185, "snappy": 0.5, "decay": 0.18, "level": 0 },
    "CH": { "decay": 0.04, "tone": 7000, "tune": 1.0, "level": 0 },
    "OH": { "decay": 0.5, "tone": 7000, "tune": 1.0, "level": 0 },
    "CP": { "decay": 0.3, "tone": 1100, "spread": 10, "level": 0 },
    "LT": { "tune": 95, "pitchAmt": 1.6, "decay": 0.35, "level": 0 }
  }
}
```

### 6.2 Pattern(Phase 2)

```json
{
  "schema": "lab1.pattern",
  "version": 1,
  "name": "Basic House",
  "bpm": 122,
  "swing": 0,
  "length": 16,
  "tracks": {
    "BD": [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    "CH": [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
  }
}
```

- ステップ値は 0(OFF)または 0–1 のベロシティ。省略トラックは全 OFF とみなす。
- インポート検証(FR-044): `schema` / `version` の一致 → 各値を ParamSpec の min/max に
  クランプ or 拒否(範囲逸脱はエラーメッセージに key と許容範囲を含める)。

---

## 7. シーケンサー設計(Phase 2)

```ts
class Sequencer {
  pattern: Pattern;
  private eventId: number | null;

  start() {
    Tone.Transport.bpm.value = this.pattern.bpm;
    Tone.Transport.swing = this.pattern.swing;      // 16分裏に適用
    Tone.Transport.swingSubdivision = "16n";
    this.eventId = Tone.Transport.scheduleRepeat((time) => {
      const step = this.currentStep(time);
      for (const [id, steps] of Object.entries(this.pattern.tracks)) {
        const vel = steps[step];
        if (vel > 0) engine.trigger(id as VoiceId, vel, time);  // 未来時刻を透過
      }
      Tone.Draw.schedule(() => ui.setPlayhead(step), time);     // UI 更新は Draw 経由
    }, "16n");
    Tone.Transport.start();
  }
}
```

- 発音時刻の根拠は Transport の look-ahead のみ(NFR-02)。UI のプレイヘッド更新は
  `Tone.Draw` で音声時刻に同期させ、逆に UI から発音タイミングを決めない。
- 再生中の編集(FR-054)は pattern オブジェクトの参照書き換えだけで反映される
  (コールバックが毎ステップ現在値を読むため)。
- Phase 1 との接続点は `engine.trigger(id, vel, time)` の 1 本のみ。Phase 1 実装時に
  time 引数を省略可能にしておけば、Phase 2 でエンジン側の変更はゼロ。

---

## 8. リスクと対策

| リスク | 対策 |
|---|---|
| 常駐オシレーター(ハット×6基×2)の CPU 負荷 | 6 基共有+分岐構成へ最適化(§3.3)。計測して問題なければ素直な 12 基構成を優先(可読性重視) |
| iOS Safari の AudioContext 自動再生制限 | 既存 LAB-1 の「電源を入れる」フローを共用(初回タップで Tone.start) |
| リトリガー時のクリックノイズ | cancel 前に 2ms の強制リリース(§2) |
| window.storage / localStorage の挙動差(不存在キーで throw) | StorageAdapter 側で null に正規化し、上位層は分岐しない |
| Transport.swing の効き方が想定とズレる | 受け入れ時に実測。合わなければ scheduleRepeat 内で偶数ステップに手動オフセットを加算する実装に差し替え(インターフェース不変) |

---

## 9. テスト戦略

音源はオフラインレンダリングで自動検証できる(NFR-08)。UI を介さず DrumEngine を直接叩く。

1. **波形特性テスト**: `Tone.Offline(({transport}) => { voice.trigger(0, 1) }, 1.0)` で
   1 秒レンダリングし、以下をアサートする。
   - RMS エンベロープ形状(decay 変更が減衰時間に単調反映されること)
   - スペクトル重心(BD < LT < SD < CP < CH/OH の順序関係。「らしさ」の粗い回帰検知)
   - ピーク値がクリップしないこと(全ボイス最大ベロシティ同時発音でも -0.5 dBFS 以下)
2. **チョークテスト**: OH trigger 後 100ms で CH trigger → 150ms 時点の OH 系統出力が
   -40dB 以下に落ちていること。
3. **シリアライズ往復テスト**: `loadKit(JSON.parse(JSON.stringify(toKitJSON())))` で
   全パラメータが一致すること。不正 JSON(範囲外・型違い・schema 不一致)の拒否テスト。
4. **スケジューリングテスト(P2)**: Offline レンダリングで 4 小節分のオンセット検出を行い、
   ステップ間隔の分散が閾値以下であること。swing 設定時は裏拍のみ遅延していること。

---

## 10. 実装マイルストーン

| # | 内容 | 完了条件 |
|---|---|---|
| M1 | MasterBus 分離 + モード切替 | SYNTH モードが従来通り動く(リグレッションなし) |
| M2 | BD / SD 実装 + パッド 2 個 | 受け入れ基準 1 の一部 |
| M3 | CH / OH / CP / LT + チョーク | 受け入れ基準 1, 2 |
| M4 | パラメータ UI(paramSpecs 駆動) | 全ボイス編集可能 |
| M5 | 永続化 + JSON 入出力 + ファクトリーキット | 受け入れ基準 3, 4 |
| M6 | モバイル調整 + テスト整備 | 受け入れ基準 5, 6 / §9 の 1–3 |
| M7 | (P2) Sequencer + パターン保存 | FR-05x / §9 の 4 |
