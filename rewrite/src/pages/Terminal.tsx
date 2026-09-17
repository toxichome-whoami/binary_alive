import React, { useState, useEffect, useRef } from 'react';
import { terminalApi } from '../api/terminal';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Play, Eraser } from 'lucide-react';

interface TerminalLine {
  id: string;
  type: 'cmd' | 'output' | 'err' | 'warn' | 'info';
  content: string;
  cwd?: string;
}

export const Terminal: React.FC = () => {
  const { user } = useAuthStore();
  const [cwd, setCwd] = useState<string>('~');
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome-1',
      type: 'info',
      content: 'Binary Alive Terminal — v2.0 (Node.js & Turso)',
    },
    {
      id: 'welcome-2',
      type: 'warn',
      content: 'All commands executed here run on the host server and are permanently logged to the audit trail.',
    },
    {
      id: 'welcome-3',
      type: 'info',
      content: 'Type "help" for a list of built-in helpers, or run standard shell commands.',
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

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
            'Built-in Commands:\n  help        - Show this help summary\n  clear       - Clear screen (or press Ctrl+L)\n  system      - Display server, runtime, and OS details\n\nAll other commands are sent directly to the host shell.',
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
          content: `User:        ${user?.username}\nRole:        ${user?.role}\nHost:        ${user?.hostname || 'binary-alive'}\nNode.js:     Active Runtime\nDate:        ${new Date().toISOString()}`,
        },
      ]);
      return true;
    }
    return false;
  };

  const handleRunCommand = async (cmdToRun = inputVal) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed) return;

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
              content: '[Command killed: Exceeded 30 second execution limit]',
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
            content: res.message || 'Execution error',
          },
        ]);
      }
    } catch (err: any) {
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'err',
          content: err.message || 'Failed to communicate with terminal API',
        },
      ]);
    } finally {
      setIsRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
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
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Host Terminal
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Admin console session with working directory persistence
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setLines([])}>
          <Eraser className="w-4 h-4" />
          Clear
        </Button>
      </div>

      {/* Terminal emulator container — Cloudflare styled */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="rounded-lg border border-[#222222] bg-[#080808] text-gray-200 font-mono text-xs flex flex-col h-[70vh] overflow-hidden"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#101010] border-b border-[#1f1f1f] text-[11px] text-[#8c8c8c] select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></span>
            <span className="ml-2 text-gray-300 font-medium">
              bash — {user?.username}@{user?.hostname || 'server'}
            </span>
          </div>
          <span className="text-[10px] text-[#555555]">Press Ctrl+L to clear</span>
        </div>

        {/* Terminal Content Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2">
          {lines.map((line) => {
            if (line.type === 'cmd') {
              return (
                <div key={line.id} className="pt-2">
                  <div className="text-emerald-400 font-semibold">{line.cwd || cwd}</div>
                  <div className="flex items-center gap-2 text-gray-100">
                    <span className="text-sky-400 font-bold">$</span>
                    <span className="font-semibold text-white">{line.content}</span>
                  </div>
                </div>
              );
            }
            if (line.type === 'err') {
              return (
                <pre key={line.id} className="text-rose-400 whitespace-pre-wrap break-all">
                  {line.content}
                </pre>
              );
            }
            if (line.type === 'warn') {
              return (
                <pre key={line.id} className="text-amber-400 whitespace-pre-wrap break-all">
                  {line.content}
                </pre>
              );
            }
            if (line.type === 'info') {
              return (
                <pre key={line.id} className="text-sky-400 whitespace-pre-wrap break-all">
                  {line.content}
                </pre>
              );
            }
            return (
              <pre key={line.id} className="text-gray-300 whitespace-pre-wrap break-all">
                {line.content}
              </pre>
            );
          })}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Input Bar */}
        <div className="p-3 bg-[#101010] border-t border-[#1f1f1f] flex items-center gap-2">
          <span className="text-emerald-400 font-semibold text-xs hidden sm:inline">{cwd}</span>
          <span className="text-sky-400 font-bold">$</span>
          <input
            ref={inputRef}
            type="text"
            disabled={isRunning}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? 'Command executing...' : 'Type a command and press Enter...'}
            className="flex-1 bg-transparent text-white focus:outline-none font-mono text-xs placeholder-gray-600 disabled:opacity-50"
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            disabled={isRunning || !inputVal.trim()}
            onClick={() => handleRunCommand()}
            className="text-gray-400 hover:text-white"
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
