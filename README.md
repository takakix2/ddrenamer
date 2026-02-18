# DDRenamer

Rustの堅牢性とTauriの軽量さを備えた高機能リネームツールです。

![DDRenamer Icon](public/tauri.svg)

## 🌟 特徴

- **🚀 爆速リネーム**: Rust (`std::fs`) によるOSネイティブな高速ファイル操作。
- **🛡️ 安全設計**: 
  - 実行結果をサイドバーログでリアルタイム表示。
  - 同名ファイル存在チェック、空名バリデーション搭載。
  - **拡張子保護**: 文字変換時に誤って拡張子を書き換えないスマート・トリートメント機能。
- **🎨 モダンUI**: 
  - **Tauri v2** + React + Tailwind CSS による洗練されたインターフェース。
  - ガラスモフィズムなドロップゾーンとスムーズなタブアニメーション。
  - ダークモード標準搭載。
- **Cross-Platform**: Windows, macOS, Linux 対応。

## 🛠 機能一覧

タブ切り替えにより、以下の高度なリネーム操作を直感的に行えます。

### 1. リネーム (Rename)
- 全ファイルを指定した名前に統一。
- 拡張子の維持/破棄を選択可能。

### 2. 追加 (Add)
- **Add**: 先頭または末尾に文字列を追加（拡張子を跨がない安全設計）。

### 3. 削除 (Trim)
- **Trim**: 先頭または末尾からN文字を削除。

### 4. 置換 (Replace)
- **Replace**: 文字列置換 (**正規表現 Regex 対応**)。

### 5. 連番 (Serial)
- **Advanced Serial**: 接頭辞 (Prefix) + 連番 + 接尾辞 (Suffix)。
- **Keep Original**: 元のファイル名を残したまま連番を付与可能 (`Vacation_001.jpg` 等)。
- **Manual Increment**: ファイルを1つずつドロップするたびにカウントアップする「手動連番」モード搭載。
- **Padding Control**: 桁数（0埋め）を自在に指定。

### 6. 変換 (Convert)
- **Case**: 大文字/小文字変換 (UPPERCASE / lowercase)。**Stemのみに適用**。
- **Width**: 全角/半角変換 (ＡＢＣ ↔ ABC)。**Stemのみに適用**。
- **Extension**: 拡張子の一括変更。

## 📦 ビルドとインストール

### 前提条件
- Node.js (v18+)
- Rust (Cargo)

### 開発モード起動
```bash
npm install
npm run tauri dev
```

### リリースビルド
```bash
npm run tauri build
```
生成されたバイナリ (`src-tauri/target/release/bundle/`) を使用してください。

## ⚠️ Known Issues / Notes
- **Wayland (Linux)**: デスクトップ環境の制約により、ファイルマネージャーからのドラッグ＆ドロップが動作しない場合があります。X11環境または他OSでは正常に動作します。

## 📜 ライセンス
MIT License (or Unlicense) - This is a personal restoration project.
Based on the concept of original DDRenamer by soft.NU.
