import React, { useEffect, useState } from 'react';
import { Server, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const AiStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Checking AI connection...');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/ai/status');
        const data = await res.json();
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'AI Connected');
        } else {
          setStatus('error');
          setMessage(data.message || 'AI Configuration Error');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Network error checking AI status');
      }
    };
    
    checkStatus();
  }, []);

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1b1b1b] border border-gray-800 shadow-md transition-all group hover:bg-[#252525]">
      {status === 'loading' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
      {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
      
      <span className={`text-xs font-medium tracking-wide ${status === 'success' ? 'text-gray-300' : status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
        {status === 'loading' ? 'Checking AI...' : status === 'success' ? 'AI Ready' : 'AI Error'}
      </span>

      {/* Tooltip on hover */}
      {status === 'error' && (
        <div className="absolute top-full right-0 mt-2 w-64 p-2 bg-red-950/90 border border-red-900/50 rounded-lg text-xs text-red-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
          {message}
        </div>
      )}
    </div>
  );
};
