# tag-zip-labeler

求人CSVへ「Indeed用求人関連タグ」と「郵便番号1」を付与するGitHub Pagesツールです。

## 現在の方針

郵便番号の処理は既存仕様を維持しています。

求人タグ判定は、移行期間のため2モードを併存させています。

### 現行方式（Legacy）

- 当面のデフォルト。
- `keyword_master.json` を使用。
- 対象列、職種コード名称、特徴コード名称を連結し、キーワードの完全部分一致でコードを付与。
- 既存利用者向けの挙動を変更しない。

### 高精度（Advanced / 試験運用）

- 画面で明示的に切り替えた場合だけ使用。
- `job-tag-alias-master` の共通マスタと判定エンジンを参照。
- 別表記、除外語、context、pattern、token境界を考慮。
- `matched` のタグだけをCSVへ自動追加。
- `review` と `suppressed` はCSVへ追加せず、抽出結果プレビューで根拠を確認可能。
- 入力CSVに既に存在するIndeed用求人関連タグは削除せず保持する。

## CSVアップロード

CSVは次の2通りでアップロードできます。

- アップロードエリアをクリックしてファイル選択
- CSVファイルをアップロードエリアへドラッグ＆ドロップ

どちらも同じ処理関数へ渡すため、文字コード判定・求人タグ判定・郵便番号付与の挙動は共通です。

## 郵便番号出力

郵便番号は、求人管理画面へそのままアップロードできる通常のCSV値として固定出力します。

従来の「システム用 / Excel確認用」切替UIは撤去しています。

CSVをExcelで開くと、Excel側の表示・型解釈によって先頭の `0` が消えて見える場合があります。ツール側の出力仕様が変わったことを意味するものではありません。

## Advancedの参照先

```text
/job-tag-alias-master/data/job-tags.json
/job-tag-alias-master/config/matching-defaults.json
/job-tag-alias-master/matcher.js
```

`advanced-tagger.js` が上記をまとめて読み込みます。

Advanced資源は起動時には読み込まず、ユーザーが「高精度（試験運用）」を選択した時だけlazy loadします。

読み込みに失敗した場合もLegacyは利用できます。

## 判定用テキスト

Legacyでは従来どおり対象セルをスペースで連結します。

AdvancedではCSV列名と値を構造化フィールドとして判定器へ渡します。プレビュー表示用には従来どおりラベル付き改行テキストも生成します。

例:

```text
仕事名：医薬品配送ドライバー
仕事内容：病院へ医薬品を配送します
勤務地：物流センター
応募資格：普通免許
待遇・福利厚生：マイカー通勤も可
職種コード名称：ドライバー・配達・配送
```

これにより、たとえば「病院」が配送先なのか勤務先なのかをcontext判定しやすくします。

`勤務場所名1` は判定時に `勤務地` というラベルへ変換します。

## CSV出力

どちらのモードでも出力CSVの基本構造は従来どおりです。

Advancedでは、

```text
既存のIndeed用求人関連タグ
+
Advancedでmatchedになったタグ
→ 重複除去
→ Indeed用求人関連タグへ出力
```

とします。

`review` / `suppressed` は出力タグコードには追加しません。

## 抽出結果プレビュー

Advancedで処理した場合は各求人に、

- 追加
- 要確認
- 抑止
- 詳細

を表示します。

詳細モーダルでは、タグコード、canonical、HIT表現、判定理由、周辺文脈を確認できます。

既存CSVに入っていたタグは判定結果に関係なく保持します。
「既存コードと一致」は、既存コードのうち本文からAdvancedでも再検出できたものを示します。

## デフォルトモード

現時点ではコード上でLegacyをデフォルトにしています。

```js
const [tagMode, setTagMode] = useState('legacy');
```

Advancedの検証と組織内合意が完了したら、将来はデフォルトをAdvancedへ切り替えます。

ブラウザのlocalStorageにはモードを保存しません。
そのため、管理側でデフォルトを変更した際に古いPCだけLegacyへ固定されることを防げます。

## 共通マスタとの役割分担

- `keyword_master.json`: Legacy専用として維持
- `job-tag-alias-master`: Advancedおよび今後の他ツールで共通利用するタグ判定基盤

Advanced側では現在、Legacyのkeyword masterには存在しない短語タグも、安全なpolicyを使って扱えます。

## 変更時の注意

- 郵便番号の検索・付与ロジックは変更しない。出力は通常CSV形式に固定し、Excel用数式化を復活させる場合は別途仕様確認する。
- Legacyの `combinedText.includes(rule.keyword)` を削除・置換しない。
- Advancedで `review` を自動付与へ昇格させない。
- 既存タグコードをAdvanced判定だけを理由に削除しない。
- `job-tag-alias-master` のschema変更時は `advanced-tagger.js` の互換性を確認する。
