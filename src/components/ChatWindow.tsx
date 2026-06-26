import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { Message } from './Message';
import { InputBox } from './InputBox';
import { Bot, Sparkles, FolderTree, FileSpreadsheet, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { Upload } from './Upload';

export const ChatWindow: React.FC = () => {
  const sessions = useChatStore(s => s.sessions);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const setOneDriveModalOpen = useChatStore(s => s.setOneDriveModalOpen);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length]);

  if (!activeSession) {
    return (
      <div className="flex-1 bg-[#212121] flex items-center justify-center text-gray-400 text-sm">
        No active chat selected.
      </div>
    );
  }

  const isOnlyWelcome = activeSession.messages.length === 1 && activeSession.messages[0].id.startsWith('welcome');

  return (
    <div className="flex-1 bg-[#212121] flex flex-col h-full overflow-hidden relative select-text">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto w-full">
        {isOnlyWelcome ? (
          <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col items-center animate-in fade-in duration-300">
            {/* Hero AI Bot Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-2xl mb-6">
              <div className="w-full h-full bg-[#1e1e1e] rounded-[14px] flex items-center justify-center text-blue-400">
                <Bot className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white text-center tracking-tight mb-2">
              INI Agent
            </h1>
            <p className="text-sm text-blue-400 font-mono flex items-center gap-1.5 mb-8">
              <Sparkles className="w-3.5 h-3.5" /> Powered by LangGraph Orchestration Engine
            </p>

            {/* Exactly formatted Welcome Card */}
            <div className="w-full bg-[#1b1b1b] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl mb-8 text-gray-200 text-[15px] leading-relaxed">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Hello 👋
              </h2>
              <p className="mb-4 text-gray-300 font-medium">
                I'm your INI Agent.
              </p>
              <p className="mb-3 text-gray-400 text-sm uppercase font-mono tracking-wider">
                I can:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 pl-1 text-sm text-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">•</span> Analyze uploaded Excel files
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">•</span> Read Modules, EDI and Document sheets
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">•</span> Search your OneDrive template repository
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">•</span> Choose the best matching INI template
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">•</span> Generate production-ready INI files
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold">•</span> Preserve template formatting
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <span className="text-blue-400 font-bold">•</span> Validate generated configuration
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between flex-wrap gap-4">
                <span className="text-emerald-400 font-semibold flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="w-4 h-4" /> Upload an Excel file to begin.
                </span>

                <button
                  onClick={() => setOneDriveModalOpen(true)}
                  className="text-xs font-mono bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 border border-blue-800/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <FolderTree className="w-3.5 h-3.5" /> View OneDrive Repo
                </button>
              </div>
            </div>

            {/* Quick Excel Upload Box */}
            <div className="w-full mb-6">
              <Upload />
            </div>

            {/* Architectural Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-xs text-gray-400">
              <div className="bg-[#181818] p-4 rounded-xl border border-gray-800/80 flex flex-col gap-1.5">
                <div className="text-blue-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> LangGraph Reasoning
                </div>
                <span>Orchestrates 9 intelligent nodes: upload triage, sheet extraction, template matching, and INI formatting.</span>
              </div>

              <div className="bg-[#181818] p-4 rounded-xl border border-gray-800/80 flex flex-col gap-1.5">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4" /> Read-Only OneDrive
                </div>
                <span>Recursively searches template repository without ever writing or permanently saving files to OneDrive.</span>
              </div>

              <div className="bg-[#181818] p-4 rounded-xl border border-gray-800/80 flex flex-col gap-1.5">
                <div className="text-purple-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Streaming Privacy
                </div>
                <span>Generated INI files are streamed directly to your local download bar and deleted from transient memory.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full pb-8">
            {activeSession.messages.map(msg => (
              <Message key={msg.id} message={msg} />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="w-full shrink-0 bg-[#212121] border-t border-gray-800/40 z-10">
        <InputBox />
      </div>
    </div>
  );
};
