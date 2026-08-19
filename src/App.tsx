import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslation, Trans } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { hasFiles, readFiles } from "tauri-plugin-clipboard-x-api";
import {
  Hash,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  List,
  ChevronUp,
  ChevronDown,
  Archive,
  Pencil,
  FileSignature,
  RotateCcw,
  Minus,
  Square,
  Copy,
  X,
  Settings,
  Undo2,
  CaseSensitive,
  Languages,
} from "lucide-react";

// 選択メニューは Lethe_UI_Kit の共有コンポーネント（`src/ui-kit` は symlink）。
// 自前の DropdownSelect を持っていたが、Kit のものと同じ物を二重に育てる形だったので畳んだ。
import { CustomSelect } from "./ui-kit/components/tsx/CustomSelect";
import WindowResizeHandles from "./WindowResizeHandles";
import SettingsModal from "./SettingsModal";
import { getInitialTheme, saveTheme, type Theme } from "./theme";
// ⚠️ ログの時刻だけは **hook ではなく singleton** から言語を読む。`processFiles` は
// deps `[]` の effect に捕まる（設定を `configRef` で渡しているのはそのため）ので、
// hook 由来の値を入れると「第 1 レンダーの値を握った関数」になる。実体は同じインスタンスで
// 結果も正しいが、それは**読んだ人には分からない**し lint も鳴る。意図を素直に書く。
import i18nInstance from "./i18n/config";

// macOS draws the window controls itself (titleBarStyle: "Overlay" in
// tauri.macos.conf.json), so the titlebar strip only renders the app name and
// the ─ □ ✕ buttons on the platforms that have no native ones. The strip stays
// on every platform because it is also the drag region.
const isMac = navigator.userAgent.includes("Macintosh");

// --- Types ---

type RenameMode =
  | "fixed"
  | "serial"
  | "replace"
  | "add"
  | "trim"
  | "extension"
  | "case"
  | "convert";

interface LogEntry {
  id: string;
  path: string;
  status: string;
  timestamp: string;
  success: boolean;
}

/**
 * 1 件の戻し。`path` は**今そのファイルが在る場所**、`oldName` は戻す名前。
 *
 * 📌 Undo に専用のコマンドは無い。`Fixed { keep_ext: false }` で元のフルネームを当てるのが
 * そのまま戻す操作になり、**リネームと同じ番人**（同一性判定・上書き拒否）を必ず通る。
 * 迂回する道を作らないための形なので、ここを独自実装に置き換えないこと。
 */
interface UndoStep {
  path: string;
  oldName: string;
}

/**
 * 1 ドロップ = 1 バッチ。
 *
 * ⚠️ `serialAdvance` は連番タブが進めたカウンタの量。戻すときに引かないと、
 * 次のドロップが**ずれた番号から始まる**。
 */
interface UndoBatch {
  steps: UndoStep[];
  serialAdvance: number;
}

/** 履歴を無限に伸ばさない。 */
const UNDO_HISTORY_LIMIT = 20;

let logIdCounter = 0;
function nextLogId(): string {
  return `log-${Date.now()}-${logIdCounter++}`;
}

// --- App ---

function App() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<RenameMode>("fixed");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  /**
   * Undo 履歴。
   *
   * 🚨 **ログ配列に相乗りさせないこと。** `logs` は 50 件で打ち切っているので、
   * 大量ドロップすると履歴が**静かに落ちる**。
   *
   * 🚨 **ref で持つ理由**: ドロップと keydown の `useEffect` が deps `[]` で
   * 初回レンダーのクロージャを握っている（`configRef` が在るのと同じ事情）。
   * state だけで持つと `Ctrl+Z` が**常に空の履歴**を見る。
   * `canUndo` はボタンの活性表示のためだけの写し。
   */
  const undoHistoryRef = useRef<UndoBatch[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const handleThemeChange = (next: Theme) => {
    setTheme(next);
    saveTheme(next); // localStorage への保存と `data-theme` の適用はここ 1 箇所
  };

  /**
   * 先頭/末尾はこのアプリで 3 回出てくる同じ選択肢。
   *
   * 🚨 **モジュールスコープの定数にしてはいけない。** `t()` は言語で変わるので、
   * 定数のまま持つと**言語を切り替えてもこの 3 つのセレクタだけ古い言語で残る**
   * （しかも他が全部切り替わるので、見落とすと「たまたま訳し忘れ」に見える）。
   */
  const positionOptions = useMemo(
    () => [
      { value: "start", label: t("position.start") },
      { value: "end", label: t("position.end") },
    ],
    [t],
  );

  const caseOptions = useMemo(
    () => [
      { value: "lower", label: t("case.lower") },
      { value: "upper", label: t("case.upper") },
    ],
    [t],
  );

  const widthOptions = useMemo(
    () => [
      { value: "hankaku", label: t("convert.hankaku") },
      { value: "zenkaku", label: t("convert.zenkaku") },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const win = getCurrentWindow();
    win.isMaximized().then(val => { if (!cancelled) setIsMaximized(val); });
    win.onResized(async () => {
      if (!cancelled) setIsMaximized(await win.isMaximized());
    }).then(u => { unlisten = u; });
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  /**
   * 窓を掴んで動かす。
   *
   * 🚨 **`data-tauri-drag-region` 属性だけでは Linux で掴めない。**
   * WebKitGTK は CSS の `-webkit-app-region: drag` を実装していないし（エラーも出ない）、
   * 属性を置くだけでも当てにならない。**明示的に `startDragging()` を呼ぶのが Tauri の流儀**
   * （権限 `core:window:allow-start-dragging` は capabilities に既に入っている）。
   * Tabula の HeaderBar が同じ実装。
   *
   * ⚠️ **属性はイベント target 自身に要る**（バブリングして来た子要素には効かない）ので、
   * 掴ませたい入れ子には全部付ける。アイコン等は `pointer-events: none` で親に透過させる。
   */
  const handleDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).hasAttribute("data-tauri-drag-region")) {
      getCurrentWindow().startDragging();
    }
  };


  // --- Config States ---

  // 1. Fixed
  const [fixedName, setFixedName] = useState("");

  // 2. Serial
  const [useSerialText, setUseSerialText] = useState(true);
  const [serialText, setSerialText] = useState("Img_");
  const [serialPosition, setSerialPosition] = useState<"start" | "end">("start");
  const inputPrefixRef = useRef<HTMLInputElement>(null);
  const [serialStart, setSerialStart] = useState(1);
  const [serialPad, setSerialPad] = useState(3);
  const [removeOriginal, setRemoveOriginal] = useState(false);


  // 3. Replace / Add / Trim
  const [replaceFrom, setReplaceFrom] = useState("");
  const [replaceTo, setReplaceTo] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [addText, setAddText] = useState("");
  const [addPos, setAddPos] = useState<"start" | "end">("end");
  const [trimCount, setTrimCount] = useState(1);
  const [trimPos, setTrimPos] = useState<"start" | "end">("end");

  // 4. Extension
  const [newExtension, setNewExtension] = useState("jpg");

  // 5. Case / Convert
  //
  // 🚨 Both modes were implemented in Rust and unreachable from here until
  // 2026-08-19: `RenameCommand` had eight variants and this file sent six.
  // Nothing warned about it -- the seam between the two is a JSON string tag,
  // so neither compiler could see the two modes that were never sent.
  const [caseMode, setCaseMode] = useState<"upper" | "lower">("lower");
  const [widthMode, setWidthMode] = useState<"zenkaku" | "hankaku">("hankaku");

  // Generic
  const [keepExt, setKeepExt] = useState(true);

  // Refs — snapshot of config for event handler closure
  const configRef = useRef({
    activeTab,
    fixedName, keepExt,
    useSerialText, serialText, serialPosition, serialStart, serialPad, removeOriginal,
    replaceFrom, replaceTo, useRegex, addText, addPos, trimCount, trimPos,
    newExtension,
    caseMode, widthMode,
  });

  useEffect(() => {
    configRef.current = {
      activeTab,
      fixedName, keepExt,
      useSerialText, serialText, serialPosition, serialStart, serialPad, removeOriginal,
      replaceFrom, replaceTo, useRegex, addText, addPos, trimCount, trimPos,
      newExtension,
      caseMode, widthMode,
    };
  }, [
    activeTab, fixedName, keepExt,
    useSerialText, serialText, serialPosition, serialStart, serialPad, removeOriginal,
    replaceFrom, replaceTo, useRegex, addText, addPos, trimCount, trimPos,
    newExtension,
    caseMode, widthMode,
  ]);



  // Auto-focus on Prefix input when Serial tab is active
  useEffect(() => {
    if (activeTab === "serial" && inputPrefixRef.current) {
      inputPrefixRef.current.focus();
    }
  }, [activeTab]);

  // --- File Processing Logic ---
  const processFiles = async (paths: string[]) => {
    if (paths.length === 0) return;

    const cfg = configRef.current;
    const { activeTab } = cfg;

    const newLogs: LogEntry[] = [];
    const undoSteps: UndoStep[] = [];

    for (let i = 0; i < paths.length; i++) {
        const filePath = paths[i];
        let cmd: any;

        const num = cfg.serialStart + i;

        switch (activeTab) {
          case "fixed":
            cmd = {
              mode: "Fixed",
              config: { name: cfg.fixedName, keep_ext: cfg.keepExt },
            };
            break;
          case "serial":
            cmd = {
              mode: "Serial",
              config: {
                text: cfg.useSerialText ? cfg.serialText : "",
                position: cfg.serialPosition,
                number: num,
                pad: cfg.serialPad,
                keep_ext: cfg.keepExt,
                keep_original: !cfg.removeOriginal,
              },
            };
            break;
          case "replace":
            cmd = {
              mode: "Replace",
              config: { from: cfg.replaceFrom, to: cfg.replaceTo, use_regex: cfg.useRegex },
            };
            break;
          case "add":
            cmd = {
              mode: "Add",
              config: { text: cfg.addText, position: cfg.addPos },
            };
            break;
          case "trim":
            cmd = {
              mode: "Trim",
              config: { count: cfg.trimCount, position: cfg.trimPos },
            };
            break;
          case "extension":
            cmd = { mode: "Extension", config: { new_ext: cfg.newExtension } };
            break;
          case "case":
            cmd = { mode: "Case", config: { mode: cfg.caseMode } };
            break;
          case "convert":
            cmd = { mode: "Convert", config: { mode: cfg.widthMode } };
            break;
          default:
            continue;
        }

        try {
          const res: {
            path: string;
            status: string;
            new_name?: string;
            new_path?: string;
          } = await invoke("handle_rename", { path: filePath, cmd });
          // 戻す材料は**表示文字列からではなく構造から**取る。
          // `status` は `-> IMG_001.jpg` という見せるための値で、状態ではない。
          if (res.status === "Success" && res.new_path) {
            const oldName = filePath.slice(
              Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")) + 1,
            );
            undoSteps.push({ path: res.new_path, oldName });
          }
          newLogs.unshift({
            id: nextLogId(),
            path: res.path,
            // 📌 **ログの status は英語で固定**（Rust `lib.rs` が返す機械の値）。UI クロームとは
            // 別のレーンなので i18n しない。`new_name` が在るのは Success のときだけなので、
            // 「Success かつ new_name 無し」の分岐は畳んで status をそのまま出す。
            status: res.new_name ? `-> ${res.new_name}` : res.status,
            timestamp: new Date().toLocaleTimeString(i18nInstance.language),
            success: res.status === "Success",
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          newLogs.unshift({
            id: nextLogId(),
            path: filePath,
            status: `Error: ${message}`,
            timestamp: new Date().toLocaleTimeString(i18nInstance.language),
            success: false,
          });
        }
    }

    setLogs((prev) => [...newLogs, ...prev].slice(0, 50));

    // Auto-increment serial start if we did serial renames
    let serialAdvance = 0;
    if (activeTab === "serial") {
      const successCount = newLogs.filter((log) => log.success).length;
      if (successCount > 0) {
        serialAdvance = successCount;
        setSerialStart((prev) => prev + successCount);
      }
    }

    if (undoSteps.length > 0) {
      undoHistoryRef.current = [
        ...undoHistoryRef.current,
        { steps: undoSteps, serialAdvance },
      ].slice(-UNDO_HISTORY_LIMIT);
      setCanUndo(true);
    }
  };

  /**
   * 直前のバッチを戻す。
   *
   * ⚠️ **元の順序で戻すこと（逆順にしない）。** 1 バッチの中で `photo1 -> photo2` と
   * `photo2 -> photo3` が起きていると、逆順では `photo3 -> photo2` が既存の `photo2` と
   * ぶつかる。元の順序なら常に**空いた先**へ戻る。
   *
   * ⚠️ **Undo が生んだ行は履歴に積まない。** 積むと ↶ の連打で戻ったり戻らなかったりする。
   */
  const undoLast = async () => {
    const history = undoHistoryRef.current;
    const batch = history[history.length - 1];
    if (!batch) return;

    undoHistoryRef.current = history.slice(0, -1);
    setCanUndo(undoHistoryRef.current.length > 0);

    const newLogs: LogEntry[] = [];
    for (const step of batch.steps) {
      try {
        const res: { path: string; status: string; new_name?: string } = await invoke(
          "handle_rename",
          {
            path: step.path,
            cmd: { mode: "Fixed", config: { name: step.oldName, keep_ext: false } },
          },
        );
        newLogs.unshift({
          id: nextLogId(),
          path: res.path,
          status: res.new_name ? `-> ${res.new_name}` : res.status,
          timestamp: new Date().toLocaleTimeString(i18nInstance.language),
          success: res.status === "Success",
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        newLogs.unshift({
          id: nextLogId(),
          path: step.path,
          status: `Error: ${message}`,
          timestamp: new Date().toLocaleTimeString(i18nInstance.language),
          success: false,
        });
      }
    }

    setLogs((prev) => [...newLogs, ...prev].slice(0, 50));
    if (batch.serialAdvance > 0) {
      setSerialStart((prev) => Math.max(1, prev - batch.serialAdvance));
    }
  };

  // `Ctrl+Z` は deps [] の keydown ハンドラから呼ぶので、ref 越しに最新を見せる。
  const undoLastRef = useRef(undoLast);
  useEffect(() => {
    undoLastRef.current = undoLast;
  });

  // --- Drag-Drop Event (Tauri v2 API) ---
  useEffect(() => {
    const webview = getCurrentWebview();
    const unlistenPromise = webview.onDragDropEvent(async (event) => {
      const payload = event.payload;

      if (payload.type === "enter") {
        setIsDragOver(true);
        return;
      }

      if (payload.type !== "drop") {
        setIsDragOver(false);
        return;
      }

      setIsDragOver(false);
      const paths = payload.paths;
      processFiles(paths);

    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // --- Keyboard Event (Ctrl+V) ---
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const modifier = e.ctrlKey || e.metaKey;

      // ⌘, / Ctrl+, で設定。⚠️ **入力欄の early-return より前**に置く ——
      // macOS の ⌘, は「どこにフォーカスが在っても効く」のが標準の作法で、
      // 入力中だけ効かないと壊れて見える。
      if (modifier && e.key === ',') {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        return;
      }

      // ignore if input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // WebKitGTK は入力欄の `Ctrl+Z` / `Ctrl+Shift+Z` を既定では処理しない
        // （`Ctrl+A` / `C` / `V` / `X` は効くのにこの 2 つだけ落ちる）。だが **editing command
        // 経路には undo が在る**ので、そこへ繋ぐ。2026-08-01 に blackcube で実測:
        // `"abcdef" -> "abc"` と**打鍵の塊単位**で戻り、redo も往復する。
        // controlled input でも壊れない（`execCommand` が `input` を発火するので state が追従する。
        // 再レンダーを起こしても値が巻き戻らないことを確認済み）。
        //
        // ⚠️ **macOS では触らない。** あちらは Tauri v2 が付ける既定メニュー（Edit ロール）＋
        // WKWebView の undo manager で**既に効いている**（2026-08-01 m4air で実機確認）。
        // 二重に undo する危険しかないので `!isMac` で閉じる。
        //
        // ⚠️ **`queryCommandEnabled('undo')` で判断しないこと。** 実行が成功する場面でも
        // `false` を返すのを実測した（`exec=true` なのに `enabled=false`）。戻り値で判断する。
        if (!isMac && modifier && e.key.toLowerCase() === 'z') {
          // 失敗したときは preventDefault しない（既定の処理に道を残す）。
          if (document.execCommand(e.shiftKey ? 'redo' : 'undo')) {
            e.preventDefault();
          }
        }
        return;
      }

      // ⚠️ **入力欄の early-return より後**に置く（`⌘,` とは逆）。
      // 名前欄で打ち間違えたときの `Ctrl+Z` は「文字を戻す」であって
      // 「リネームを戻す」ではない。`Ctrl+V` と同じ土地の話。
      if (modifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastRef.current();
        return;
      }

      if (modifier && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        try {
          // tauri-plugin-clipboard-x: 全OS対応のファイル読み取り
          if (await hasFiles()) {
            const result = await readFiles();
            if (result.paths && result.paths.length > 0) {
              processFiles(result.paths);
            }
          }
        } catch (err) {
          console.error("Paste error", err);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);



  return (
    <div className="app-shell">
      {/* 窓の縁（decorations:false には縁が無いので自前）。
          ⚠️ macOS は `decorations: true` ＝ **ネイティブの縁が既に在る**ので置かない。
          置くと透明な板がネイティブの当たり判定より前に出て、かえって邪魔になる。 */}
      {!isMac && <WindowResizeHandles />}

      {/* CSD Titlebar — on macOS the native traffic lights sit here instead */}
      <div className="titlebar" data-tauri-drag-region onPointerDown={handleDrag}>
        {!isMac && (
          <>
            <span className="titlebar-title" data-tauri-drag-region>DDRenamer</span>
            <div className="titlebar-buttons">
              <button className="titlebar-btn" onClick={handleMinimize} title={t("titlebar.minimize")}>
                <Minus size={16} />
              </button>
              <button className="titlebar-btn" onClick={handleToggleMaximize} title={isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}>
                {isMaximized ? <Copy size={13} /> : <Square size={13} />}
              </button>
              <button className="titlebar-btn close" onClick={handleClose} title={t("titlebar.close")}>
                <X size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Header / Tabs - 2 Rows */}
      <div className="mode-tabs">
        {/* Row 1: リネーム, 追加, 削除, ケース変換 */}
        <div className="mode-tabs-row">
          <TabButton id="fixed" icon={<Pencil size={18} />} label={t("tabs.fixed")} active={activeTab} onSelect={setActiveTab} />
          <TabButton id="add" icon={<List size={18} />} label={t("tabs.add")} active={activeTab} onSelect={setActiveTab} />
          <TabButton id="trim" icon={<Archive size={18} />} label={t("tabs.trim")} active={activeTab} onSelect={setActiveTab} />
          <TabButton id="case" icon={<CaseSensitive size={18} />} label={t("tabs.case")} active={activeTab} onSelect={setActiveTab} />
        </div>
        {/* Row 2: 置換, 連番付与, 拡張子, 全角/半角 */}
        <div className="mode-tabs-row">
          <TabButton id="replace" icon={<ArrowRightLeft size={18} />} label={t("tabs.replace")} active={activeTab} onSelect={setActiveTab} />
          <TabButton id="serial" icon={<Hash size={18} />} label={t("tabs.serial")} active={activeTab} onSelect={setActiveTab} />
          <TabButton id="extension" icon={<FileSignature size={18} />} label={t("tabs.extension")} active={activeTab} onSelect={setActiveTab} />
          <TabButton id="convert" icon={<Languages size={18} />} label={t("tabs.convert")} active={activeTab} onSelect={setActiveTab} />
        </div>
      </div>

      {/* Main Content Area - Split Vertical */}
      <div className="app-body">
        {/* Config Area - Compact */}
        <div className="config-area">
          <div className="config-panel">

            {/* --- FIXED --- */}
            {activeTab === "fixed" && (
              <div className="field-stack animate-in fade-in slide-in-from-top-2">
                <div className="field-row center">
                  <input
                    type="text"
                    value={fixedName}
                    onChange={(e) => setFixedName(e.target.value)}
                    className="lethe-input compact field-grow"
                    placeholder=""
                  />
                  <label className="check-row">
                    <span className="toggle-switch">
                      <input type="checkbox" checked={keepExt} onChange={(e) => setKeepExt(e.target.checked)} />
                      <span className="toggle-slider" />
                    </span>
                    <span>{t("fixed.keepExt")}</span>
                  </label>
                </div>
              </div>
            )}

            {/* --- SERIAL --- */}
            {activeTab === "serial" && (
              <div className="field-stack animate-in fade-in slide-in-from-top-2">
                <div className="field-row">
                  <label className="check-row">
                    <span className="toggle-switch">
                      <input type="checkbox" checked={useSerialText} onChange={(e) => setUseSerialText(e.target.checked)} />
                      <span className="toggle-slider" />
                    </span>
                    <span>{t("serial.useText")}</span>
                  </label>
                  <div className={`field-row field-grow field-fade ${useSerialText ? "" : "off"}`}>
                    <input
                      ref={inputPrefixRef}
                      type="text"
                      value={serialText}
                      onChange={(e) => setSerialText(e.target.value)}
                      className="lethe-input compact field-grow"
                      placeholder={serialPosition === "start" ? "Img_" : "_Img"}
                      disabled={!useSerialText}
                    />
                    <CustomSelect
                      className="select-fixed"
                      value={serialPosition}
                      onChange={(v: string) => setSerialPosition(v as "start" | "end")}
                      options={positionOptions}
                    />
                  </div>
                </div>

                <div className="field-divider" />

                <div className="field-row">
                  <div className="field-col">
                    <span className="field-label">
                      {t("serial.startNumber")}
                      {serialStart !== 1 && (
                        <button className="stepper-btn" onClick={() => setSerialStart(1)} title={t("serial.resetToOne")}>
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </span>
                    <div className="stepper">
                      <button className="stepper-btn" onClick={() => setSerialStart(Math.max(0, serialStart - 1))}><ChevronDown size={14} /></button>
                      <span className="stepper-value">{serialStart}</span>
                      <button className="stepper-btn" onClick={() => setSerialStart(serialStart + 1)}><ChevronUp size={14} /></button>
                    </div>
                  </div>
                  <div className="field-col">
                    <span className="field-label">{t("serial.digits")}</span>
                    <div className="stepper">
                      <button className="stepper-btn" onClick={() => setSerialPad(Math.max(1, serialPad - 1))}><ChevronDown size={14} /></button>
                      <span className="stepper-value">{serialPad}</span>
                      <button className="stepper-btn" onClick={() => setSerialPad(serialPad + 1)}><ChevronUp size={14} /></button>
                    </div>
                  </div>

                  <div className="field-grow" />

                  <label className="check-row">
                    <span className="toggle-switch">
                      <input type="checkbox" checked={removeOriginal} onChange={(e) => setRemoveOriginal(e.target.checked)} />
                      <span className="toggle-slider" />
                    </span>
                    <span>{t("serial.dropOriginal")}</span>
                  </label>
                </div>

                {/* Live Preview */}
                <div className="preview-chip">
                  <span className="preview-chip-label">{t("serial.exampleLabel")}</span>
                  <span className="preview-chip-value">
                    {(() => {
                      const num = String(serialStart).padStart(serialPad, '0');
                      const textNum = `${useSerialText ? serialText : ''}${num}`;
                      if (removeOriginal) {
                        return `${textNum}.ext`;
                      } else if (serialPosition === 'start') {
                        return `${textNum}photo.ext`;
                      } else {
                        return `photo${textNum}.ext`;
                      }
                    })()}
                  </span>
                </div>
              </div>
            )}

            {/* --- REPLACE --- */}
            {activeTab === "replace" && (
              <div className="field-stack animate-in fade-in slide-in-from-top-2">
                <div className="form-group">
                  <label>{t("replace.searchLabel")}</label>
                  <input
                    type="text"
                    value={replaceFrom}
                    onChange={(e) => setReplaceFrom(e.target.value)}
                    className="lethe-input compact"
                    placeholder={t("replace.searchPlaceholder")}
                  />
                </div>
                <div className="form-group">
                  <label>{t("replace.replaceLabel")}</label>
                  <input
                    type="text"
                    value={replaceTo}
                    onChange={(e) => setReplaceTo(e.target.value)}
                    className="lethe-input compact"
                    placeholder={t("replace.replacePlaceholder")}
                  />
                </div>
                <label className="check-row">
                  <span className="toggle-switch">
                    <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
                    <span className="toggle-slider" />
                  </span>
                  <span>{t("replace.useRegex")}</span>
                </label>
              </div>
            )}

            {/* --- ADD --- */}
            {activeTab === "add" && (
              <div className="field-stack animate-in fade-in slide-in-from-top-2">
                <div className="field-row">
                  <input
                    type="text"
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    className="lethe-input compact field-grow"
                    placeholder=""
                  />
                  <CustomSelect
                    className="select-fixed"
                    value={addPos}
                    onChange={(v: string) => setAddPos(v as "start" | "end")}
                    options={positionOptions}
                  />
                </div>
              </div>
            )}

            {/* --- TRIM (DELETE) ---
                🚨 **このタブだけ語順が言語で変わる。**
                  ja: 「[末尾] **から** [3] **文字削除する**」
                  en: 「**Delete** [3] **characters from the** [end]」
                部品の**順序そのもの**が入れ替わるので、文字列を並べる形では表現できない。
                `<Trans>` に名前付きスロットを渡し、**並びは locale 側が決める**。
                ⚠️ `t1` / `t2` は地の文の器（`.field-text`）。地の文をスロットに入れず素の
                テキストノードにすると、当てる先が無くなって字面が周りとズレる。 */}
            {activeTab === "trim" && (
              <div className="field-row center animate-in fade-in slide-in-from-top-2">
                <Trans
                  i18nKey="trim.sentence"
                  components={{
                    pos: (
                      <CustomSelect
                        className="select-fixed"
                        value={trimPos}
                        onChange={(v: string) => setTrimPos(v as "start" | "end")}
                        options={positionOptions}
                      />
                    ),
                    count: (
                      <div className="stepper">
                        <button className="stepper-btn" onClick={() => setTrimCount(Math.max(0, trimCount - 1))}><ChevronDown size={14} /></button>
                        <span className="stepper-value">{trimCount}</span>
                        <button className="stepper-btn" onClick={() => setTrimCount(trimCount + 1)}><ChevronUp size={14} /></button>
                      </div>
                    ),
                    t1: <span className="field-text" />,
                    t2: <span className="field-text" />,
                  }}
                />
              </div>
            )}

            {/* --- EXTENSION --- */}
            {activeTab === "extension" && (
              <div className="field-stack animate-in fade-in slide-in-from-top-2">
                <div className="field-col">
                  <input
                    type="text"
                    value={newExtension}
                    onChange={(e) => setNewExtension(e.target.value)}
                    className="lethe-input compact mono"
                    placeholder={t("extension.placeholder")}
                  />
                  <p className="field-note">{t("extension.note")}</p>
                </div>
              </div>
            )}

            {/* --- CASE ---
                📌 `<Trans>` を借りているのは TRIM と同じ理由。ja は
                「名前を [小文字] にする」、en は「Make the name [lowercase]」で
                **選択子の位置が地の文の中で動く**ので、並びは locale 側に決めさせる。
                ⚠️ 拡張子を変えないことは仕様であって手抜きではない（`.JPG` を
                `.jpg` にするかは拡張子タブの仕事）。地の文でそう言っておく。 */}
            {activeTab === "case" && (
              <div className="field-row center animate-in fade-in slide-in-from-top-2">
                <Trans
                  i18nKey="case.sentence"
                  components={{
                    mode: (
                      <CustomSelect
                        className="select-fixed"
                        value={caseMode}
                        onChange={(v: string) => setCaseMode(v as "upper" | "lower")}
                        options={caseOptions}
                      />
                    ),
                    t1: <span className="field-text" />,
                    t2: <span className="field-text" />,
                  }}
                />
              </div>
            )}

            {/* --- CONVERT (全角/半角) --- */}
            {activeTab === "convert" && (
              <div className="field-row center animate-in fade-in slide-in-from-top-2">
                <Trans
                  i18nKey="convert.sentence"
                  components={{
                    mode: (
                      <CustomSelect
                        className="select-fixed"
                        value={widthMode}
                        onChange={(v: string) => setWidthMode(v as "zenkaku" | "hankaku")}
                        options={widthOptions}
                      />
                    ),
                    t1: <span className="field-text" />,
                    t2: <span className="field-text" />,
                  }}
                />
              </div>
            )}

          </div>
        </div>

        {/* Drop Zone - Bottom Half */}
        {!showLogs && (
          <div className="dropzone-area">
            <div className={`dropzone ${isDragOver ? "dragover" : ""}`}>
              <div className="dropzone-icon">
                <Archive size={32} />
              </div>
              <p className="dropzone-title">{t("dropzone.title")}</p>
              <p className="dropzone-hint">{t("dropzone.hint")}</p>
            </div>
          </div>
        )}

        {/* Footer / Logs - Collapsible */}
        <div
          className={`logbar ${showLogs ? "expanded" : ""}`}
          data-tauri-drag-region={showLogs ? undefined : true}
          onPointerDown={handleDrag}
          style={{ cursor: showLogs ? undefined : 'grab' }}
        >
          {/* 📌 右の `.logbar-actions` は設定（歯車）の席。行を button で包まないのは
              そこにボタンを置けるようにするため（button の入れ子は不正）。
              ⚠️ 歯車を**タイトルバー右**に置かないのは、あそこが OS で姿の変わる土地だから ——
              Linux は − □ ✕ が居て、macOS は（`decorations: true` なので）そもそも描いていない。
              ログバーなら全プラットフォームで同じ場所に出せるし、掴み除外幅
              (`--titlebar-controls`) にも触らずに済む。 */}
          <div className="logbar-header">
            <button className="logbar-toggle" onClick={() => setShowLogs(!showLogs)}>
              <List size={14} />
              {t("logbar.title")}
              <span className={`logbar-chevron ${showLogs ? "up" : ""}`}>
                <ChevronUp size={14} />
              </span>
            </button>
            <div className="logbar-actions">
              {/* 📌 畳んでいてもヘッダは見える。Undo が要るのは*やらかした直後*で、
                  そのときバーはまず畳まれているので、本文でなくここに置く。 */}
              <button
                className="logbar-icon-btn"
                onClick={undoLast}
                disabled={!canUndo}
                title={`${t("logbar.undo")} (${isMac ? "⌘Z" : "Ctrl+Z"})`}
              >
                <Undo2 size={15} />
              </button>
              <button
                className="logbar-icon-btn"
                onClick={() => setShowSettings(true)}
                title={`${t("settings.open")} (${isMac ? "⌘," : "Ctrl+,"})`}
              >
                <Settings size={15} />
              </button>
            </div>
          </div>
          <div className="logbar-body">
            <div className="log-list">
              {logs.map((log) => (
                <div key={log.id} className={`log-row ${log.success ? "" : "error"}`}>
                  {log.success ? (
                    <CheckCircle2 size={16} className="log-icon ok" />
                  ) : (
                    <AlertCircle size={16} className="log-icon ng" />
                  )}
                  <div className="log-body">
                    <div className="log-head">
                      <span className="log-time">{log.timestamp}</span>
                      <span className="log-path">{log.path}</span>
                    </div>
                    <div className="log-result">
                      <span className="log-arrow">↳</span>
                      <span className={`log-status ${log.success ? "ok" : "ng"}`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="logs-empty">
                  <Archive size={32} style={{ opacity: 0.5 }} />
                  <span>{t("logbar.empty")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          theme={theme}
          onThemeChange={handleThemeChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function TabButton({
  id,
  icon,
  label,
  active,
  onSelect,
}: {
  id: RenameMode;
  icon: ReactNode;
  label: string;
  active: RenameMode;
  onSelect: (mode: RenameMode) => void;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`mode-tab ${isActive ? "active" : ""}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default App;
