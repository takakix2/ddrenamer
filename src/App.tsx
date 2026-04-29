import { useState, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { hasFiles, readFiles } from "tauri-plugin-clipboard-x-api";
import {
  Hash,
  ArrowRightLeft,
  Check,
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
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-gray-300 font-sans selection:bg-[#264f78] selection:text-white overflow-hidden">
      {/* CSD Titlebar */}
      <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '32px', background: '#1e1e1e', borderBottom: '1px solid #2d2d2d', flexShrink: 0, userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab' }}>
        <span data-tauri-drag-region style={{ paddingLeft: '12px', fontSize: '12px', color: '#888', fontWeight: 500 }}>DDRenamer</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button onClick={handleMinimize} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', width: '32px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.15s' }}>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>─</span>
          </button>
          <button onClick={handleToggleMaximize} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', width: '32px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.15s' }}>
            <span style={{ fontSize: '10px', lineHeight: 1 }}>{isMaximized ? '❐' : '□'}</span>
          </button>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', width: '32px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.15s' }}>
            <span style={{ fontSize: '12px', lineHeight: 1 }}>✕</span>
          </button>
        </div>
      </div>

      {/* Header / Tabs - 2 Rows */}
      <div className="flex flex-col border-b border-[#2d2d2d] bg-[#1e1e1e]">
        {/* Row 1: リネーム, 追加, 削除 */}
        <div className="flex w-full border-b border-[#2d2d2d]">
          <TabButton id="fixed" icon={<Pencil size={18} />} label="リネーム" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="add" icon={<List size={18} />} label="追加" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="trim" icon={<Archive size={18} />} label="削除" active={activeTab} onSelect={setActiveTab} />
        </div>
        {/* Row 2: 置換, 連番付与, 拡張子 */}
        <div className="flex w-full">
          <TabButton id="replace" icon={<ArrowRightLeft size={18} />} label="置換" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="serial" icon={<Hash size={18} />} label="連番付与" active={activeTab} onSelect={setActiveTab} />
          <TabButton id="extension" icon={<FileSignature size={18} />} label="拡張子変換" active={activeTab} onSelect={setActiveTab} />
        </div>
      </div>

      {/* Main Content Area - Split Vertical */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Config Area - Compact */}
        <div className="w-full p-3 bg-[#1e1e1e]">
          <div className="w-full bg-[#252526] rounded-lg border border-[#3e3e42] p-3 shadow-sm relative group min-h-min">

            {/* --- FIXED --- */}
            {activeTab === "fixed" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={fixedName}
                      onChange={(e) => setFixedName(e.target.value)}
                      className="flex-1 !pl-3 !pr-3 h-[36px] bg-[#1a1b1e] border border-[#373a40] rounded-xl focus:outline-none focus:border-[#374458] transition-all font-medium text-sm placeholder-gray-600"
                      placeholder=""
                    />
                    <label className="flex items-center gap-3 cursor-pointer select-none px-4 py-2 hover:bg-[#2c2e33] rounded-xl transition-colors border border-transparent hover:border-[#373a40] active:scale-95 duration-200">
                      <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${keepExt ? "bg-[#283446] border-[#283446]" : "border-gray-500"}`}>
                        <input type="checkbox" checked={keepExt} onChange={(e) => setKeepExt(e.target.checked)} className="hidden" />
                        {keepExt && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-sm text-gray-300 font-medium">拡張子維持</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* --- SERIAL --- */}
            {activeTab === "serial" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
                <div className="flex gap-4 items-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 hover:bg-[#2c2e33] rounded-lg transition-colors border border-transparent hover:border-[#373a40] h-[36px] shrink-0">
                    <input type="checkbox" checked={useSerialText} onChange={(e) => setUseSerialText(e.target.checked)} className="accent-[#374458] w-4 h-4" />
                    <span className="text-sm text-gray-300 font-medium">テキスト追加</span>
                  </label>
                  <div className={`flex-1 flex gap-4 items-end transition-all duration-200 ${useSerialText ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                    <input
                      ref={inputPrefixRef}
                      type="text"
                      value={serialText}
                      onChange={(e) => setSerialText(e.target.value)}
                      className="flex-1 pl-3 pr-3 h-[36px] bg-[#1a1b1e] border border-[#373a40] rounded-lg focus:outline-none focus:border-[#374458] transition-all disabled:border-[#2d2d2d]"
                      placeholder={serialPosition === "start" ? "Img_" : "_Img"}
                      disabled={!useSerialText}
                    />
                    <DropdownSelect
                      value={serialPosition}
                      onChange={(v: string) => setSerialPosition(v as "start" | "end")}
                      options={[
                        { value: "start", label: "先頭 (Prefix)" },
                        { value: "end", label: "末尾 (Suffix)" },
                      ]}
                    />
                  </div>
                </div>

                <div className="h-px bg-[#373a40] opacity-50" />

                <div className="flex items-end gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">開始番号</label>
                      {serialStart !== 1 && (
                        <button onClick={() => setSerialStart(1)} className="text-[#5e7799] hover:text-white transition-colors" title="1にリセット">
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 bg-[#1a1b1e] border border-[#373a40] rounded-lg px-2 h-[36px]">
                      <button onClick={() => setSerialStart(Math.max(0, serialStart - 1))} className="p-2 hover:text-white text-gray-500 transition-colors"><ChevronDown size={14} /></button>
                      <span className="font-mono w-4 text-center">{serialStart}</span>
                      <button onClick={() => setSerialStart(serialStart + 1)} className="p-2 hover:text-white text-gray-500 transition-colors"><ChevronUp size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">桁数</label>
                    <div className="flex items-center gap-2 bg-[#1a1b1e] border border-[#373a40] rounded-lg px-2 h-[36px]">
                      <button onClick={() => setSerialPad(Math.max(1, serialPad - 1))} className="p-2 hover:text-white text-gray-500 transition-colors"><ChevronDown size={14} /></button>
                      <span className="font-mono w-4 text-center">{serialPad}</span>
                      <button onClick={() => setSerialPad(serialPad + 1)} className="p-2 hover:text-white text-gray-500 transition-colors"><ChevronUp size={14} /></button>
                    </div>
                  </div>

                  <div className="flex-1" />

                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 hover:bg-[#2c2e33] rounded-lg transition-colors">
                      <input type="checkbox" checked={removeOriginal} onChange={(e) => setRemoveOriginal(e.target.checked)} className="accent-[#374458] w-4 h-4" />
                      <span className="text-sm text-gray-300">元の名前を残さない</span>
                    </label>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="bg-[#1a1b1e] border border-[#373a40] rounded-lg px-4 py-2 flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 uppercase tracking-wider shrink-0">例:</span>
                  <span className="font-mono text-sm text-gray-200">
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
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
                <div className="flex flex-col gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">検索する文字列</label>
                    <input
                      type="text"
                      value={replaceFrom}
                      onChange={(e) => setReplaceFrom(e.target.value)}
                      className="w-full pl-3 pr-3 h-[36px] bg-[#1a1b1e] border border-[#373a40] rounded-xl focus:outline-none focus:border-[#374458] transition-all font-medium placeholder-gray-600"
                      placeholder="検索..."
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">置換後の文字列</label>
                    <input
                      type="text"
                      value={replaceTo}
                      onChange={(e) => setReplaceTo(e.target.value)}
                      className="w-full pl-3 pr-3 h-[36px] bg-[#1a1b1e] border border-[#373a40] rounded-xl focus:outline-none focus:border-[#374458] transition-all font-medium placeholder-gray-600"
                      placeholder="置換..."
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer select-none px-4 py-2 hover:bg-[#2c2e33] rounded-xl transition-colors border border-transparent hover:border-[#373a40] active:scale-95 duration-200 w-fit">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${useRegex ? "bg-[#374458] border-[#374458]" : "border-gray-500"}`}>
                      <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} className="hidden" />
                      {useRegex && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span className="text-sm text-gray-300 font-medium">正規表現を使用</span>
                  </label>
                </div>
              </div>
            )}

            {/* --- ADD --- */}
            {activeTab === "add" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={addText}
                      onChange={(e) => setAddText(e.target.value)}
                      className="w-full pl-3 pr-3 h-[36px] bg-[#1a1b1e] border border-[#373a40] rounded-xl focus:outline-none focus:border-[#374458] transition-all font-medium placeholder-gray-600"
                      placeholder=""
                    />
                  </div>
                  <DropdownSelect
                    value={addPos}
                    onChange={(v: string) => setAddPos(v as "start" | "end")}
                    options={[
                      { value: "start", label: "先頭 (Prefix)" },
                      { value: "end", label: "末尾 (Suffix)" },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* --- TRIM (DELETE) --- */}
            {activeTab === "trim" && (
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                <DropdownSelect
                  value={trimPos}
                  onChange={(v: string) => setTrimPos(v as "start" | "end")}
                  options={[
                    { value: "start", label: "先頭 (Prefix)" },
                    { value: "end", label: "末尾 (Suffix)" },
                  ]}
                />
                <span className="text-sm font-bold text-gray-400">から</span>
                <div className="flex items-center gap-2 bg-[#1a1b1e] border border-[#373a40] rounded-lg px-2 h-[36px]">
                  <button onClick={() => setTrimCount(Math.max(0, trimCount - 1))} className="p-2 hover:text-white text-gray-500 transition-colors"><ChevronDown size={14} /></button>
                  <span className="font-mono w-4 text-center">{trimCount}</span>
                  <button onClick={() => setTrimCount(trimCount + 1)} className="p-2 hover:text-white text-gray-500 transition-colors"><ChevronUp size={14} /></button>
                </div>
                <span className="text-sm font-bold text-gray-400">文字削除する</span>
              </div>
            )}

            {/* --- EXTENSION --- */}
            {activeTab === "extension" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={newExtension}
                      onChange={(e) => setNewExtension(e.target.value)}
                      className="w-full pl-3 pr-3 h-[36px] bg-[#1a1b1e] border border-[#373a40] rounded-xl focus:outline-none focus:border-[#374458] transition-all font-medium placeholder-gray-600 font-mono"
                      placeholder="jpg, png, txt..."
                    />
                    <p className="text-[11px] text-gray-500 text-right">ドット不要</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Drop Zone - Bottom Half */}
        {!showLogs && (
          <div className="flex-1 p-3 flex flex-col items-center justify-center relative group bg-[#1e1e1e]">
            <div
              className={`absolute inset-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-all duration-200 ${isDragOver
                ? "border-[#283446] bg-[#283446]/10 scale-[1.01]"
                : "border-[#3e3e42] group-hover:border-[#283446] group-hover:bg-[#283446]/5"
                }`}
            >
              <div
                className={`p-4 rounded-full mb-3 transition-colors duration-200 ${isDragOver ? "bg-[#283446]/20" : "bg-[#252526] group-hover:bg-[#283446]/10"
                  }`}
              >
                <Archive
                  size={32}
                  className={`transition-colors duration-200 ${isDragOver ? "text-[#283446]" : "text-gray-500 group-hover:text-[#283446]"
                    }`}
                />
              </div>
              <p
                className={`text-base font-bold transition-colors duration-200 ${isDragOver ? "text-gray-200" : "text-gray-400 group-hover:text-gray-200"
                  }`}
              >
                ファイルをここにドロップ
              </p>
              <p
                className={`text-sm mt-2 transition-colors duration-300 ${isDragOver ? "text-[#4b5f78]" : "text-gray-600 group-hover:text-[#4b5f78]"
                  }`}
              >
                自動的に処理が開始されます
              </p>
            </div>
          </div>
        )}

        {/* Footer / Logs - Collapsible */}
        <div
          data-tauri-drag-region
          className={`bg-[#141517] border-t border-[#2c2e33] flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-10 relative ${showLogs ? "flex-1 min-h-0" : "h-12"
            }`}
          style={{ cursor: showLogs ? undefined : 'grab' }}
        >
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="h-12 text-xs font-bold text-gray-500 uppercase tracking-widest bg-[#1a1b1e] hover:bg-[#25262b] transition-colors cursor-pointer w-full focus:outline-none shrink-0 border-b border-[#2c2e33]"
          >
            <div className="px-4 h-full flex justify-between items-center">
              <span className="flex items-center gap-2">
                <List size={14} />
                実行ログ
                <span className={`transition-transform duration-300 ${showLogs ? "rotate-180" : ""}`}>
                  <ChevronUp size={14} />
                </span>
              </span>
              <span className="flex items-center gap-3">
              </span>
            </div>
          </button>
          <div className="flex-1 bg-[#141517] overflow-y-auto">
            <div className="px-4 py-4 space-y-2 font-mono text-sm">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 p-2 rounded-md transition-colors ${log.success
                    ? "text-gray-300 hover:bg-[#1a1b1e]"
                    : "text-red-400 bg-red-900/10 hover:bg-red-900/20"
                    } border border-transparent hover:border-[#2c2e33]`}
                >
                  {log.success ? (
                    <CheckCircle2 size={16} className="mt-0.5 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="mt-0.5 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 break-all flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 bg-[#25262b] px-1.5 rounded">
                        {log.timestamp}
                      </span>
                      <span className="text-gray-400 font-medium">{log.path}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                      <span className="text-gray-600 text-xs">↳</span>
                      <span className={log.success ? "text-green-400 font-bold" : "text-red-400"}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-60">
                  <Archive size={32} className="mb-2 opacity-50" />
                  <span className="text-xs">履歴はありません</span>
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
      className={`relative z-10 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all duration-300 w-full
        ${isActive
          ? "bg-[#283446] text-white shadow-lg shadow-blue-900/20 scale-[1.02]"
          : "bg-[#252526] text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] hover:scale-[1.02]"
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DropdownSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 bg-[#25262b] text-gray-200 border rounded-md pl-3 pr-3 h-[36px] text-sm cursor-pointer hover:bg-[#2d2d2d] transition-all min-w-[140px] focus:outline-none ${open ? "border-[#374458]" : "border-[#3e3e42]"}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-2 ${opt.value === value
                ? "bg-[#374458]/15 text-[#4b5f78]"
                : "text-gray-300 hover:bg-[#2c2e33]"
                }`}
            >
              {opt.value === value && <Check size={12} className="shrink-0" />}
              <span className={opt.value !== value ? "pl-3" : ""}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
