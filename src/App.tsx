import { useState, useEffect, useRef, type ReactNode } from "react";
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
} from "lucide-react";

// 選択メニューは Lethe_UI_Kit の共有コンポーネント（`src/ui-kit` は symlink）。
// 自前の DropdownSelect を持っていたが、Kit のものと同じ物を二重に育てる形だったので畳んだ。
import { CustomSelect } from "./ui-kit/components/tsx/CustomSelect";

// macOS draws the window controls itself (titleBarStyle: "Overlay" in
// tauri.macos.conf.json), so the titlebar strip only renders the app name and
// the ─ □ ✕ buttons on the platforms that have no native ones. The strip stays
// on every platform because it is also the drag region.
const isMac = navigator.userAgent.includes("Macintosh");

// 先頭/末尾はこのアプリで 3 回出てくる同じ選択肢。1 箇所で持つ。
const POSITION_OPTIONS = [
  { value: "start", label: "先頭 (Prefix)" },
  { value: "end", label: "末尾 (Suffix)" },
];

// --- Types ---

type RenameMode = "fixed" | "serial" | "replace" | "add" | "trim" | "extension";

interface LogEntry {
  id: string;
  path: string;
  status: string;
  timestamp: string;
  success: boolean;
}

let logIdCounter = 0;
function nextLogId(): string {
  return `log-${Date.now()}-${logIdCounter++}`;
}

// --- App ---

function App() {
  const [activeTab, setActiveTab] = useState<RenameMode>("fixed");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

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

  // Generic
  const [keepExt, setKeepExt] = useState(true);

  // Refs — snapshot of config for event handler closure
  const configRef = useRef({
    activeTab,
    fixedName, keepExt,
    useSerialText, serialText, serialPosition, serialStart, serialPad, removeOriginal,
    replaceFrom, replaceTo, useRegex, addText, addPos, trimCount, trimPos,
    newExtension,
  });

  useEffect(() => {
    configRef.current = {
      activeTab,
      fixedName, keepExt,
      useSerialText, serialText, serialPosition, serialStart, serialPad, removeOriginal,
      replaceFrom, replaceTo, useRegex, addText, addPos, trimCount, trimPos,
      newExtension,
    };
  }, [
    activeTab, fixedName, keepExt,
    useSerialText, serialText, serialPosition, serialStart, serialPad, removeOriginal,
    replaceFrom, replaceTo, useRegex, addText, addPos, trimCount, trimPos,
    newExtension,
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
          default:
            continue;
        }

        try {
          const res: { path: string; status: string; new_name?: string } = await invoke(
            "handle_rename",
            { path: filePath, cmd }
          );
          newLogs.unshift({
            id: nextLogId(),
            path: res.path,
            status:
              res.status === "Success"
                ? res.new_name
                  ? `-> ${res.new_name}`
                  : "成功"
                : res.status,
            timestamp: new Date().toLocaleTimeString(),
            success: res.status === "Success",
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          newLogs.unshift({
            id: nextLogId(),
            path: filePath,
            status: `Error: ${message}`,
            timestamp: new Date().toLocaleTimeString(),
            success: false,
          });
        }
    }

    setLogs((prev) => [...newLogs, ...prev].slice(0, 50));

    // Auto-increment serial start if we did serial renames
    if (activeTab === "serial") {
      const successCount = newLogs.filter((log) => log.success).length;
      if (successCount > 0) {
        setSerialStart((prev) => prev + successCount);
      }
    }
  };

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
      // ignore if input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const modifier = e.ctrlKey || e.metaKey;
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
      {/* CSD Titlebar — on macOS the native traffic lights sit here instead */}
      <div className="titlebar" data-tauri-drag-region>
        {!isMac && (
          <>
            <span className="titlebar-title" data-tauri-drag-region>DDRenamer</span>
            <div className="titlebar-buttons">
              <button className="titlebar-btn" onClick={handleMinimize} title="最小化">
                <span style={{ fontSize: '14px', lineHeight: 1 }}>─</span>
              </button>
              <button className="titlebar-btn" onClick={handleToggleMaximize} title="最大化">
                <span style={{ fontSize: '10px', lineHeight: 1 }}>{isMaximized ? '❐' : '□'}</span>
              </button>
              <button className="titlebar-btn close" onClick={handleClose} title="閉じる">
                <span style={{ fontSize: '12px', lineHeight: 1 }}>✕</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Header / Tabs - 2 Rows */}
      <div className="mode-tabs">
        {/* Row 1: リネーム, 追加, 削除 */}
        <div className="mode-tabs-row">
          <TabButton id="fixed" icon={<Pencil size={18} />} label="リネーム" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="add" icon={<List size={18} />} label="追加" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="trim" icon={<Archive size={18} />} label="削除" active={activeTab} onSelect={setActiveTab} />
        </div>
        {/* Row 2: 置換, 連番付与, 拡張子 */}
        <div className="mode-tabs-row">
          <TabButton id="replace" icon={<ArrowRightLeft size={18} />} label="置換" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="serial" icon={<Hash size={18} />} label="連番付与" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="extension" icon={<FileSignature size={18} />} label="拡張子変換" active={activeTab} onSelect={setActiveTab} />
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
                    <span>拡張子維持</span>
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
                    <span>テキスト追加</span>
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
                      options={POSITION_OPTIONS}
                    />
                  </div>
                </div>

                <div className="field-divider" />

                <div className="field-row">
                  <div className="field-col">
                    <span className="field-label">
                      開始番号
                      {serialStart !== 1 && (
                        <button className="stepper-btn" onClick={() => setSerialStart(1)} title="1にリセット">
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
                    <span className="field-label">桁数</span>
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
                    <span>元の名前を残さない</span>
                  </label>
                </div>

                {/* Live Preview */}
                <div className="preview-chip">
                  <span className="preview-chip-label">例:</span>
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
                  <label>検索する文字列</label>
                  <input
                    type="text"
                    value={replaceFrom}
                    onChange={(e) => setReplaceFrom(e.target.value)}
                    className="lethe-input compact"
                    placeholder="検索..."
                  />
                </div>
                <div className="form-group">
                  <label>置換後の文字列</label>
                  <input
                    type="text"
                    value={replaceTo}
                    onChange={(e) => setReplaceTo(e.target.value)}
                    className="lethe-input compact"
                    placeholder="置換..."
                  />
                </div>
                <label className="check-row">
                  <span className="toggle-switch">
                    <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
                    <span className="toggle-slider" />
                  </span>
                  <span>正規表現を使用</span>
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
                    options={POSITION_OPTIONS}
                  />
                </div>
              </div>
            )}

            {/* --- TRIM (DELETE) --- */}
            {activeTab === "trim" && (
              <div className="field-row center animate-in fade-in slide-in-from-top-2">
                <CustomSelect
                  className="select-fixed"
                  value={trimPos}
                  onChange={(v: string) => setTrimPos(v as "start" | "end")}
                  options={POSITION_OPTIONS}
                />
                <span className="field-text">から</span>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => setTrimCount(Math.max(0, trimCount - 1))}><ChevronDown size={14} /></button>
                  <span className="stepper-value">{trimCount}</span>
                  <button className="stepper-btn" onClick={() => setTrimCount(trimCount + 1)}><ChevronUp size={14} /></button>
                </div>
                <span className="field-text">文字削除する</span>
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
                    placeholder="jpg, png, txt..."
                  />
                  <p className="field-note">ドット不要</p>
                </div>
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
              <p className="dropzone-title">ファイルをここにドロップ</p>
              <p className="dropzone-hint">自動的に処理が開始されます</p>
            </div>
          </div>
        )}

        {/* Footer / Logs - Collapsible */}
        <div
          className={`logbar ${showLogs ? "expanded" : ""}`}
          data-tauri-drag-region={showLogs ? undefined : true}
          style={{ cursor: showLogs ? undefined : 'grab' }}
        >
          {/* 📌 右の `.logbar-actions` は設定（歯車）の席。行を button で包まないのは
              そこにボタンを置けるようにするため（button の入れ子は不正）。 */}
          <div className="logbar-header">
            <button className="logbar-toggle" onClick={() => setShowLogs(!showLogs)}>
              <List size={14} />
              実行ログ
              <span className={`logbar-chevron ${showLogs ? "up" : ""}`}>
                <ChevronUp size={14} />
              </span>
            </button>
            <div className="logbar-actions" />
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
                  <span>履歴はありません</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
