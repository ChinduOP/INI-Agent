import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { ChatMessageItem } from './ChatMessageItem';
import { InputBox } from './InputBox';
import { Bot, Sparkles, FolderTree, FileSpreadsheet, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { Upload } from './Upload';
import { AiStatusIndicator } from './AiStatusIndicator';

const AnimatedStatusText = () => {
  const [index, setIndex] = useState(0);
  const statuses = ["Analysing...", "Thinking...", "Creating..."];
  
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % statuses.length);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-sm font-medium text-blue-400 animate-pulse">{statuses[index]}</span>
  );
};

export const ChatWindow: React.FC = () => {
  const sessions = useChatStore(s => s.sessions);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const setOneDriveModalOpen = useChatStore(s => s.setOneDriveModalOpen);
  const isGenerating = useChatStore(s => s.isGenerating && s.activeSessionId === s.generatingSessionId);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, isGenerating]);

  if (!activeSession) {
    return (
      <div className="flex-1 theme-surface flex items-center justify-center theme-muted text-sm">
        No active chat selected.
      </div>
    );
  }

  return (
    <div className="flex-1 theme-surface flex flex-col h-full overflow-hidden relative select-text">
      <AiStatusIndicator />
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="w-full pb-8">
          {activeSession.messages.map(msg => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))}
          
          {isGenerating && (
            <div className="w-full py-6 px-4 sm:px-6 flex gap-4 transition-colors bg-transparent">
              <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center !text-white text-white shadow-md bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-blue-500/30">
                <Bot className="w-5 h-5 !text-white text-white" />
              </div>
              <div className="flex-1 overflow-hidden pt-0.5 flex flex-col w-full max-w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">
                    INI Agent
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-mono border border-blue-200 dark:border-blue-800/60 font-semibold">
                    <Sparkles className="w-2.5 h-2.5" /> LangGraph Orchestrated
                  </span>
                </div>
                <div className="font-sans break-words mt-1">
                  <AnimatedStatusText />
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="w-full shrink-0 theme-surface border-t theme-border z-10">
        <InputBox />
      </div>
    </div>
  );
};
