'use client';

import { useEffect, useState, useRef } from 'react';
import { Terminal, Activity, Server, Clock } from 'lucide-react';
import { motion } from 'motion/react';

type LogEntry = {
  type: string;
  message: string;
  time: string;
  id: string;
};

export default function LiveConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [secret, setSecret] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard_secret') || '';
    }
    return '';
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('dashboard_secret');
    }
    return false;
  });
  const endRef = useRef<HTMLDivElement>(null);

  const handleSetSecret = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('dashboard_secret', secret);
    setIsLocked(true);
  };

  const handleResetSecret = () => {
    localStorage.removeItem('dashboard_secret');
    setSecret('');
    setIsLocked(false);
    setIsConnected(false);
    setLogs([]);
  };

  useEffect(() => {
    if (!isLocked || !secret) return;

    let evtSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      evtSource = new EventSource(`/api/logs?secret=${encodeURIComponent(secret)}`);
      evtSource.onopen = () => setIsConnected(true);
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const newLog: LogEntry = {
            ...data,
            id: Math.random().toString(36).substring(2, 9),
          };
          setLogs((prev) => [...prev.slice(-199), newLog]); // Keep last 200 logs
        } catch (e) {}
      };
      evtSource.onerror = () => {
        setIsConnected(false);
        evtSource?.close();
      };
    };

    connectSSE();

    // Fallback polling strategy if proxy drops SSE silently
    fallbackInterval = setInterval(async () => {
      if (!isConnected) {
        connectSSE();
      }
    }, 5000);

    return () => {
      if (evtSource) evtSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [isConnected, isLocked, secret]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isLocked) {
    return (
      <div className="flex flex-col h-[500px] border border-white/10 rounded-xl bg-black overflow-hidden shadow-2xl relative ring-1 ring-white/5 isolate items-center justify-center p-6">
        <div className="absolute inset-0 h-40 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-50 pointer-events-none -z-10 blur-xl" />
        <Terminal className="w-12 h-12 text-indigo-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Live Console Locked</h2>
        <p className="text-neutral-400 text-sm text-center mb-6 max-w-md">
          Please enter the dashboard secret to view live console logs. This secret must match the DASHBOARD_SECRET environment variable.
        </p>
        <form onSubmit={handleSetSecret} className="flex gap-2 w-full max-w-sm">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter secret..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] border border-white/10 rounded-xl bg-black overflow-hidden shadow-2xl relative ring-1 ring-white/5 isolate">
      {/* Glossy Header Overlay */}
      <div className="absolute inset-0 h-40 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-50 pointer-events-none -z-10 blur-xl" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-neutral-900 rounded-md border border-white/10 shadow-sm">
            <Terminal className="w-4 h-4 text-neutral-400" />
          </div>
          <h2 className="text-sm font-medium tracking-tight text-neutral-200">Terminal Output</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <button
            onClick={handleResetSecret}
            className="text-neutral-500 hover:text-white transition-colors"
            title="Lock Console"
          >
            Lock
          </button>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Server className="w-3.5 h-3.5" />
            <span>Node.js v22</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center justify-center">
              <span
                className={`absolute w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 blur-sm' : 'bg-red-500 blur-sm'}`}
              ></span>
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}
              ></span>
            </div>
            <span className={isConnected ? 'text-emerald-400/90' : 'text-red-400/90'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Console Area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed text-neutral-300 relative z-0">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600 gap-2">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Waiting for logs...</span>
          </div>
        ) : (
          <div className="flex flex-col pb-4">
             {logs.map((log) => (
                <div key={log.id} className="group flex gap-3 py-1 px-2 -mx-2 rounded hover:bg-white/5 transition-colors duration-150">
                  <span className="text-neutral-600 shrink-0 select-none flex items-center gap-1">
                    {new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`break-all ${log.type === 'error' ? 'text-red-400 font-medium' : log.message.includes('[Info]') || log.message.includes('Bot logged in') ? 'text-indigo-400 font-medium' : 'text-neutral-300'}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}
