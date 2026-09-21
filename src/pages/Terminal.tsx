import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAuthStore } from '../store/authStore';
import { Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export const Terminal: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const hasAccess = !!(user && (hasPermission('terminal_access') || user.role === 'owner'));

  useEffect(() => {
    if (!hasAccess) {
      return;
    }

    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#0B0B0C',
        foreground: '#e5e5e5',
        cursor: '#2f80ed',
        selectionBackground: 'rgba(47, 128, 237, 0.3)'
      },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 14,
      scrollback: 5000,
    });
    xtermRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws`;

    const connectTerminal = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        term.write('\r\n[Connected]\r\n');
        // Let backend know the initial size
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'data') {
            term.write(parsed.data);
          } else if (parsed.type === 'error') {
            term.write(`\r\n\x1b[31m[Error] ${parsed.message}\x1b[0m\r\n`);
          }
        } catch (e) {
          // Drop invalid raw text to prevent escape sequence injection
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        term.write('\r\n[Connection Closed. Press any key to restart.]\r\n');
      };
    };

    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'data', data }));
      } else {
        // Reconnect if disconnected
        term.write('\r\n[Starting new session...]\r\n');
        connectTerminal();
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial connection
    connectTerminal();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) wsRef.current.close();
      term.dispose();
    };
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="w-full max-w-[1200px] mx-auto p-4 flex flex-col items-center justify-center min-h-[50vh]">
        <TerminalIcon className="w-12 h-12 text-[#333333] mb-4" />
        <h2 className="text-[18px] font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-[14px] text-[#8c8c8c]">You do not have permission to access the terminal.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col mx-auto bg-[#0B0B0C] border border-[#222222] rounded-lg overflow-hidden shadow-sm">
      <div className="h-10 px-4 bg-black border-b border-[#222222] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-[#8c8c8c]" />
          <span className="text-[14px] font-medium text-white tracking-tight">Interactive Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-[12px] text-[#8c8c8c]">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      <div className="flex-1 w-full p-2 overflow-hidden relative">
        <div ref={terminalRef} className="w-full h-full absolute inset-0 p-2" />
      </div>
    </div>
  );
};
