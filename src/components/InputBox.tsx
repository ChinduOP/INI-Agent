import React, { useRef, useState, useEffect } from 'react';
import { Paperclip, Send, Loader2, FileSpreadsheet, X, FolderTree } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useMappingStore } from '../store/mappingStore';
import { Upload } from './Upload';

export const InputBox: React.FC = React.memo(() => {
  const [input, setInput] = useState('');
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSessionId = useChatStore(s => s.activeSessionId);
  const sessions = useChatStore(s => s.sessions);
  const addMessage = useChatStore(s => s.addMessage);
  const isGenerating = useChatStore(s => s.isGenerating && s.activeSessionId === s.generatingSessionId);
  const setGenerating = useChatStore(s => s.setGenerating);
  const setOneDriveModalOpen = useChatStore(s => s.setOneDriveModalOpen);
  const selectedIniFiles = useChatStore(s => s.selectedIniFiles);
  const setSelectedIniFiles = useChatStore(s => s.setSelectedIniFiles);
  const setActiveView = useChatStore(s => s.setActiveView);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const uploadedExcel = activeSession?.uploadedExcel;

  // Auto grow textarea height up to max
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if ((!input.trim() && selectedIniFiles.length === 0) || !activeSessionId || isGenerating) return;

    const userMessageText = input.trim() || `Generate files for: ${selectedIniFiles.map(f => f.filename).join(', ')}`;
    const attachedInis = selectedIniFiles; // Capture current state
    setInput('');
    setSelectedIniFiles([]); // Clear after sending
    setShowUploadDrawer(false); // Close upload drawer when sending message
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Prepare attachments
    const attachments = [];
    if (uploadedExcel) {
      attachments.push({ name: uploadedExcel.name, size: 0, path: uploadedExcel.path });
    }
    attachedInis.forEach(ini => {
      attachments.push({ name: ini.filename, size: ini.content.length, path: ini.path });
    });

    // Add user message
    addMessage(activeSessionId, {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: userMessageText,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined
    });

    try {
      setGenerating(true);
      const { globalMappings, tabularMappings } = useMappingStore.getState();

      // Call backend chat LangGraph endpoint
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageText,
          chatHistory: activeSession?.messages || [],
          selectedTemplateAttachments: attachedInis,
          textMappings: {
            globalMappings,
            tabularMappings
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed communicating with LangGraph engine');
      }

      addMessage(activeSessionId, {
        id: 'msg_' + Date.now(),
        role: 'assistant',
        content: data.assistantMessage,
        timestamp: Date.now(),
        generatedInis: data.generatedInis,
        trace: data.trace
      });
    } catch (err: any) {
      addMessage(activeSessionId, {
        id: 'err_' + Date.now(),
        role: 'assistant',
        content: `❌ **LangGraph Execution Failure**\n\n${err.message || 'Network error occurred while orchestrating nodes.'}`,
        timestamp: Date.now()
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full mx-auto px-4 pb-6 pt-2">
      {/* Active Attachment Banner */}
      {uploadedExcel && (
        <div className="mb-2 theme-surface-muted border theme-border rounded-lg px-3 py-1.5 flex items-center justify-between text-xs theme-secondary">
          <div className="flex items-center gap-2 truncate">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium truncate">{uploadedExcel.name}</span>
            <span className="text-gray-400 text-[11px] font-mono">(Modules, EDI, Document ready)</span>
          </div>
          <button
            onClick={() => useChatStore.getState().setUploadedExcel(activeSessionId!, null)}
            className="theme-muted hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded transition-colors cursor-pointer"
            title="Detach Excel workbook"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {selectedIniFiles.length > 0 && (
        <div className="mb-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs theme-secondary">
          <div className="flex items-center gap-2 truncate">
            <FolderTree className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-medium truncate">{selectedIniFiles.length} INI Templates selected</span>
            <span className="text-gray-400 text-[11px] font-mono">({selectedIniFiles.map(f => f.filename).join(', ')})</span>
          </div>
          <button
            onClick={() => setSelectedIniFiles([])}
            className="theme-muted hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded transition-colors cursor-pointer"
            title="Detach INI Templates"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Drawer Popout */}
      {showUploadDrawer && (
        <div className="mb-3 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Attach Excel Workbook</span>
            <button
              onClick={() => setShowUploadDrawer(false)}
              className="theme-muted hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Upload onSuccess={() => setShowUploadDrawer(false)} />
        </div>
      )}

      {/* Main Input Box */}
      <div className="relative flex items-end bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg transition-colors overflow-hidden p-1.5 focus-within:border-gray-200 dark:focus-within:border-gray-700 focus-within:ring-0 focus-within:outline-none">
        <div className="flex items-center pb-1 pl-1 gap-1">
          {/* File Attachment Icon */}
          <button
            type="button"
            onClick={() => setShowUploadDrawer(!showUploadDrawer)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              showUploadDrawer || uploadedExcel 
                ? 'bg-blue-600 !text-white text-white hover:bg-blue-700' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-300'
            }`}
            title="Upload Excel workbook (.xlsx)"
          >
            <Paperclip className={`w-5 h-5 cursor-pointer ${showUploadDrawer || uploadedExcel ? '!text-white text-white' : ''}`} />
          </button>

          {/* Template Selector Button */}
          <button
            type="button"
            onClick={() => setOneDriveModalOpen(true)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-300 rounded-xl transition-colors inline-flex cursor-pointer"
            title="Select Template from Folder"
          >
            <FolderTree className="w-5 h-5 cursor-pointer" />
          </button>
        </div>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedIniFiles.length > 0
              ? `${selectedIniFiles.length} files selected. Click Send or press Enter to generate!`
              : uploadedExcel
              ? "Ask INI Agent (e.g. 'Create Partner A 850 INI' or 'Partner B 856')..."
              : "Upload an Excel file or ask a question to begin..."
          }
          rows={1}
          className="flex-1 max-h-[180px] bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm outline-none ring-0 focus:outline-none focus:ring-0 focus:border-transparent border-0 resize-none py-2.5 px-3 leading-relaxed font-sans shadow-none"
        />

        {/* Send Button */}
        <div className="pb-1 pr-1">
          <button
            type="button"
            onClick={handleSend}
            disabled={(!input.trim() && selectedIniFiles.length === 0) || isGenerating}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${
              (input.trim() || selectedIniFiles.length > 0) && !isGenerating
                ? 'bg-blue-600 !text-white text-white hover:bg-blue-700 shadow cursor-pointer'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title="Send Message to LangGraph Orchestrator"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            ) : (
              <Send className={`w-5 h-5 ${(input.trim() || selectedIniFiles.length > 0) && !isGenerating ? '!text-white text-white' : ''}`} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1">
        <span>INI Agent uses LangGraph multi-step reasoning • OneDrive repository is Read-Only</span>
        <div className="flex gap-2">
          <button onClick={() => setInput("Create Partner A 850 INI")} className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer">Partner A 850</button>
          <span>•</span>
          <button onClick={() => setInput("Generate Partner B 856 INI")} className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer">Partner B 856</button>
        </div>
      </div>
    </div>
  );
});
