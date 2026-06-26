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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let evtSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      evtSource = new EventSource('/api/logs');
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
  }, [isConnected]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

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
