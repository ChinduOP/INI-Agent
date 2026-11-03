import React from 'react';
import { Plus, MessageSquare, PanelLeftClose, PanelLeft, FolderTree, Trash2, Bot, Sparkles, Database, Sun, Moon } from 'lucide-react';
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
  const theme = useChatStore(s => s.theme);
  const toggleTheme = useChatStore(s => s.toggleTheme);

  if (isSidebarCollapsed) {
    return (
      <div className="w-14 theme-surface-muted border-r theme-border flex flex-col items-center py-4 gap-4 shrink-0 z-20">
        <button
          onClick={toggleSidebar}
          className="p-2.5 rounded-lg theme-muted hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          title="Expand sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <button
          onClick={createNewSession}
          className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors cursor-pointer"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveView('templates')}
          className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
            activeView === 'templates' ? 'bg-blue-600/20 text-blue-600 dark:text-blue-300' : 'theme-muted hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-800'
          }`}
          title="Template Manager"
        >
          <FolderTree className="w-5 h-5" />
        </button>

        <div className="flex-1" />
        
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg theme-muted hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors mb-4 cursor-pointer"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 sm:w-72 theme-surface-muted border-r theme-border flex flex-col h-full shrink-0 z-20 transition-all select-none">
      {/* Top Brand & Collapse header */}
      <div className="p-3.5 border-b theme-border flex items-center justify-between">
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center !text-white text-white shadow">
            <Bot className="w-5 h-5 !text-white text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight theme-primary flex items-center gap-1.5">
              INI Agent
            </h1>
            <p className="text-[10px] text-blue-400 font-mono flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> LangGraph Engine
            </p>
          </div>
        </div>

        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg theme-muted hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat & Template Manager Buttons */}
      <div className="p-3 space-y-2">
        <button
          onClick={createNewSession}
          className="w-full flex items-center justify-start gap-2.5 px-3.5 py-2.5 rounded-xl theme-surface-elevated theme-surface-hover border theme-border-strong hover:border-gray-500 theme-primary text-sm font-medium transition-all shadow-sm group cursor-pointer"
        >
          <Plus className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <span>New Chat</span>
        </button>

        <button
          onClick={() => setActiveView('templates')}
          className={`w-full flex items-center justify-start gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all shadow-sm group text-sm font-medium cursor-pointer ${
            activeView === 'templates'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'theme-surface-elevated theme-surface-hover theme-border-strong hover:border-gray-500 theme-primary'
          }`}
        >
          <FolderTree className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeView === 'templates' ? 'text-blue-400' : 'theme-muted'}`} />
          <span>Template Manager</span>
        </button>
      </div>

      {/* Chat History Section Title */}
      <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>Chat History</span>
        <span className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold px-2 py-0.5 rounded-full text-[10px]">{sessions.length}</span>
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
                  ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-semibold shadow-xs' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-blue-700 dark:hover:text-blue-300 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className="truncate">{session.title}</span>
              </div>

              {sessions.length > 1 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-all cursor-pointer"
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
      <div className="p-3 border-t theme-border mt-auto flex flex-col gap-3">
        <div 
          onClick={toggleTheme}
          className="flex items-center justify-between w-full p-2.5 rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#252525] border border-gray-200 dark:border-gray-800 shadow-xs transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span className="text-xs font-medium">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-[14px]' : 'translate-x-0.5'}`} />
          </div>
        </div>
        <div className="px-2 text-[10px] text-gray-400 dark:text-gray-500 text-center flex items-center justify-center gap-2">
          <span>Excel Analyzer</span>
          <span>•</span>
          <span>Direct Access</span>
        </div>
      </div>
    </div>
  );
};
