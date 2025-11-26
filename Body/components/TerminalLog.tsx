import React, { useEffect, useRef } from 'react';
import { LogEntry, LogLevel } from '../types';
import { Terminal, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface TerminalLogProps {
  logs: LogEntry[];
}

const TerminalLog: React.FC<TerminalLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getIcon = (level: LogLevel) => {
    switch (level) {
      case LogLevel.SUCCESS: return <CheckCircle className="w-3 h-3 text-emerald-500" />;
      case LogLevel.ERROR: return <AlertCircle className="w-3 h-3 text-red-500" />;
      case LogLevel.WARNING: return <AlertCircle className="w-3 h-3 text-yellow-500" />;
      default: return <Info className="w-3 h-3 text-blue-400" />;
    }
  };

  const getColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.SUCCESS: return 'text-emerald-400';
      case LogLevel.ERROR: return 'text-red-400';
      case LogLevel.WARNING: return 'text-yellow-400';
      default: return 'text-blue-300';
    }
  };

  return (
    <div className="w-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden shadow-2xl flex flex-col h-64 md:h-80">
      <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-gray-700">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">System Log</span>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-xs md:text-sm space-y-1 terminal-scroll"
      >
        {logs.length === 0 && (
          <div className="text-gray-600 italic">Waiting for processes to start...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 items-start animate-fade-in">
            <span className="text-gray-600 shrink-0 select-none">
              [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}]
            </span>
            <div className="mt-0.5 shrink-0">
              {getIcon(log.level)}
            </div>
            <span className={`${getColor(log.level)} break-words`}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerminalLog;
