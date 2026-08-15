import React from 'react';
import { Plus, MessageSquare, PanelLeftClose, PanelLeft, FolderTree, Trash2, Bot, Sparkles, Database } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export const Sidebar: React.FC = () => {
  const sessions = useChatStore(s => s.sessions);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const activeView = useChatStore(s => s.activeView);
  const isSidebarCollapsed = useChatStore(s => s.isSidebarCollapsed);
  const createNewSession = useChatStore(s => s.createNewSession);
  const setActiveSession = useChatStore(s => s.setActiveSession);
  const setActiveView = useChatStore(s => s.setActiveView);
  const toggleSidebar = useChatStore(s => s.toggleSidebar);
  const deleteSession = useChatStore(s => s.deleteSession);
  const setOneDriveModalOpen = useChatStore(s => s.setOneDriveModalOpen);

  if (isSidebarCollapsed) {
    return (
      <div className="w-14 bg-[#171717] border-r border-gray-800 flex flex-col items-center py-4 gap-4 shrink-0 z-20">
        <button
          onClick={toggleSidebar}
          className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <button
          onClick={createNewSession}
          className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveView('templates')}
          className={`p-2.5 rounded-lg transition-colors ${
            activeView === 'templates' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Template Manager"
        >
          <FolderTree className="w-5 h-5" />
        </button>

        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="w-64 sm:w-72 bg-[#171717] border-r border-gray-800 flex flex-col h-full shrink-0 z-20 transition-all select-none">
      {/* Top Brand & Collapse header */}
      <div className="p-3.5 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              INI Agent
            </h1>
            <p className="text-[10px] text-blue-400 font-mono flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> LangGraph Engine
            </p>
          </div>
        </div>

        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat & Template Manager Buttons */}
      <div className="p-3 space-y-2">
        <button
          onClick={createNewSession}
          className="w-full flex items-center justify-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#232323] hover:bg-[#2b2b2b] border border-gray-700 hover:border-gray-500 text-gray-100 text-sm font-medium transition-all shadow-sm group"
        >
          <Plus className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <span>New Chat</span>
        </button>

        <button
          onClick={() => setActiveView('templates')}
          className={`w-full flex items-center justify-start gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all shadow-sm group text-sm font-medium ${
            activeView === 'templates'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'bg-[#232323] hover:bg-[#2b2b2b] border-gray-700 hover:border-gray-500 text-gray-100'
          }`}
        >
          <FolderTree className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeView === 'templates' ? 'text-blue-400' : 'text-gray-400'}`} />
          <span>Template Manager</span>
        </button>
      </div>

      {/* Chat History Section Title */}
      <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
        <span>Chat History</span>
        <span className="bg-gray-800 text-gray-400 px-1.5 py-0.2 rounded-full text-[10px]">{sessions.length}</span>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {sessions.map(session => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                isActive 
                  ? 'bg-[#262626] text-white font-medium shadow-sm' 
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className="truncate">{session.title}</span>
              </div>

              {sessions.length > 1 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 rounded transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Credits */}
      <div className="p-3 border-t border-gray-800 mt-auto">
        <div className="px-2 text-[10px] text-gray-500 text-center flex items-center justify-center gap-2">
          <span>Excel Analyzer</span>
          <span>•</span>
          <span>Direct Access</span>
        </div>
      </div>
    </div>
  );
};
