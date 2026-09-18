import React, { useState, useEffect, useRef } from 'react';
import { terminalApi } from '../api/terminal';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Eraser, Copy, Check, Terminal as TerminalIcon } from 'lucide-react';

interface TerminalLine {
  id: string;
  type: 'cmd' | 'output' | 'err' | 'warn' | 'info';
  content: string;
  cwd?: string;
  timestamp?: string;
}

export const Terminal: React.FC = () => {
  const { user } = useAuthStore();
  const { push: pushToast } = useToastStore();

  const [cwd, setCwd] = useState<string>('~');
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasCopiedBuffer, setHasCopiedBuffer] = useState<boolean>(false);

  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome-1',
      type: 'info',
      content: 'Type "help" for commands.',
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new content arrives
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [lines, isRunning]);

  const handleClear = () => {
    setLines([]);
    pushToast('info', 'Terminal cleared');
  };

  const handleCopyBuffer = () => {
    const fullText = lines
      .map((l) => (l.type === 'cmd' ? `$ ${l.content}` : l.content))
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setHasCopiedBuffer(true);
    pushToast('success', 'Terminal session copied');
    setTimeout(() => setHasCopiedBuffer(false), 1500);
  };

  const runBuiltin = (cmd: string): boolean => {
    if (cmd === 'clear') {
      setLines([]);
      return true;
    }
    if (cmd === 'help') {
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'info',
          content:
            'Commands:\n  help    Show available commands\n  clear   Clear screen (Ctrl+L)\n  system  Host runtime info',
        },
      ]);
      return true;
    }
    if (cmd === 'system') {
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'output',
          content: `User:        ${user?.username || 'admin'}\nRole:        ${user?.role || 'admin'}\nHost:        ${user?.hostname || 'binary-alive'}\nRuntime:     Node.js active\nTime:        ${new Date().toISOString()}`,
        },
      ]);
      return true;
    }
    return false;
  };

  const handleRunCommand = async (cmdToRun = inputVal) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed || isRunning) return;

    // Push into history
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputVal('');

    // Add command line to display
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        type: 'cmd',
        content: trimmed,
        cwd,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);

    if (runBuiltin(trimmed)) {
      return;
    }

    setIsRunning(true);
    try {
      const res = await terminalApi.execute(trimmed);
      if (res.success) {
        if (res.cwd) setCwd(res.cwd);

        if (res.timed_out) {
          setLines((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              type: 'err',
              content: '[Process terminated: Exceeded 30-second execution deadline]',
            },
          ]);
        }

        if (res.output && res.output.trim() !== '') {
          setLines((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              type: 'output',
              content: res.output.replace(/\n$/, ''),
            },
          ]);
        }

        if (res.exit_code !== 0 && res.exit_code !== null) {
          setLines((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              type: 'warn',
              content: `[Process returned exit code ${res.exit_code}]`,
            },
          ]);
        }
      } else {
        setLines((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'err',
            content: res.message || 'Command execution error',
          },
        ]);
      }
    } catch (err: any) {
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'err',
          content: err.message || 'Failed to communicate with terminal daemon',
        },
      ]);
    } finally {
      setIsRunning(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRunCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([]);
    }
  };
  return (
    <div
      style={{
        fontFamily:
          '"Inter Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      }}
      className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col font-sans select-none min-h-0 h-full"
    >
      {/* Cloudflare-style Container matching Dashboard.tsx */}
      <div className="mx-[6px] mb-[6px] flex-1 flex flex-col border border-[#262626] rounded-lg overflow-hidden bg-[#0e0e0e] min-h-0 shadow-sm relative">
        
        {/* Header - exactly 40px height matching table headers */}
        <div className="flex items-center justify-between px-3 border-b border-[#222222] bg-[#141414] h-[40px] min-h-[40px] max-h-[40px] shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-[14px] font-medium text-white tracking-tight flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-[#8c8c8c]" />
              Terminal
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 h-7 px-2 rounded hover:bg-[#1f1f1f] text-[13px] font-medium text-[#8c8c8c] hover:text-white transition-colors cursor-pointer select-none"
              title="Clear terminal output (Ctrl+L)"
            >
              <Eraser className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>

            <button
              type="button"
              onClick={handleCopyBuffer}
              className="flex items-center gap-1.5 h-7 px-2 rounded hover:bg-[#1f1f1f] text-[13px] font-medium text-[#8c8c8c] hover:text-white transition-colors cursor-pointer select-none"
              title="Copy terminal session buffer"
            >
              {hasCopiedBuffer ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#30a46c] shrink-0" />
                  <span className="text-[#30a46c] hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Terminal Output & Inline Prompt Stream */}
        <div
          ref={streamContainerRef}
          onClick={() => inputRef.current?.focus()}
          className="flex-1 p-3 sm:p-4 overflow-y-auto font-mono text-[14px] leading-relaxed selection:bg-[#264f78] space-y-1.5 select-text cursor-text"
        >
          {lines.map((line) => {
            if (line.type === 'cmd') {
              return (
                <div key={line.id} className="pt-1.5 first:pt-0 flex items-start gap-2 text-[14px]">
                  <span className="text-[#8c8c8c] text-[13px] select-none font-sans shrink-0 truncate max-w-[120px] sm:max-w-[200px]" title={line.cwd || cwd}>
                    {line.cwd || cwd}
                  </span>
                  <span className="text-[#555555] select-none shrink-0">$</span>
                  <span className="text-white font-medium select-text break-all">{line.content}</span>
                </div>
              );
            }
            if (line.type === 'err') {
              return (
                <div key={line.id} className="text-[#e5484d] whitespace-pre-wrap break-all text-[14px] leading-relaxed select-text">
                  {line.content}
                </div>
              );
            }
            if (line.type === 'warn') {
              return (
                <div key={line.id} className="text-[#f59e0b] whitespace-pre-wrap break-all text-[14px] leading-relaxed select-text">
                  {line.content}
                </div>
              );
            }
            if (line.type === 'info') {
              return (
                <div key={line.id} className="text-[#8c8c8c] whitespace-pre-wrap break-all text-[14px] leading-relaxed select-text">
                  {line.content}
                </div>
              );
            }
            return (
              <div key={line.id} className="text-[#d4d4d4] whitespace-pre-wrap break-all text-[14px] leading-relaxed select-text">
                {line.content}
              </div>
            );
          })}

          {/* Active Inline Command Prompt */}
          <div className="flex items-center gap-2 pt-1.5">
            <span className="text-[#8c8c8c] text-[13px] select-none font-sans shrink-0 truncate max-w-[120px] sm:max-w-[200px]" title={cwd}>
              {cwd}
            </span>
            <span className="text-[#555555] select-none shrink-0">$</span>
            <div className="relative flex-1 flex items-center min-w-0">
              <input
                ref={inputRef}
                type="text"
                disabled={isRunning}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? 'Executing command...' : ''}
                className="w-full bg-transparent text-white focus:outline-none font-mono text-[14px] placeholder-[#555555] disabled:opacity-50 caret-[#2f80ed] m-0 p-0 border-none leading-relaxed"
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {isRunning && (
              <span className="w-2 h-2 rounded-full bg-[#2f80ed] animate-pulse shrink-0" title="Executing..." />
            )}
          </div>

          <div ref={terminalEndRef} className="h-2" />
        </div>

        {/* Technical Diagnostics & Command Quick Chips - Bottom Bar */}
        <div className="flex items-center justify-between px-3 border-t border-[#222222] bg-[#141414] h-[40px] min-h-[40px] max-h-[40px] shrink-0 text-[13px] text-[#8c8c8c] select-none">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {['system', 'help', 'uptime', 'pm2 status', 'ls -la'].map((quickCmd) => (
              <button
                key={quickCmd}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunCommand(quickCmd);
                }}
                disabled={isRunning}
                className="px-2.5 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] border border-[#262626] hover:border-[#383838] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer font-mono text-[13px] disabled:opacity-40 whitespace-nowrap"
              >
                {quickCmd}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[#555555] font-sans text-[13px] shrink-0 ml-4 hidden md:flex">
            <span>
              History: <kbd className="font-mono px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#262626] text-[#8c8c8c] ml-0.5">↑</kbd> <kbd className="font-mono px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#262626] text-[#8c8c8c]">↓</kbd>
            </span>
            <span>
              Execute: <kbd className="font-mono px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#262626] text-[#8c8c8c] ml-0.5">↵</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

