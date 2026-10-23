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

    const userMessageText = input.trim() || `Generate INIs for: ${selectedIniFiles.map(f => f.filename).join(', ')}`;
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
        <div className="mb-2 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-gray-200">
          <div className="flex items-center gap-2 truncate">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium truncate">{uploadedExcel.name}</span>
            <span className="text-gray-400 text-[11px] font-mono">(Modules, EDI, Document ready)</span>
          </div>
          <button
            onClick={() => useChatStore.getState().setUploadedExcel(activeSessionId!, null)}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            title="Detach Excel workbook"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {selectedIniFiles.length > 0 && (
        <div className="mb-2 bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-gray-200">
          <div className="flex items-center gap-2 truncate">
            <FolderTree className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-medium truncate">{selectedIniFiles.length} INI Templates selected</span>
            <span className="text-gray-400 text-[11px] font-mono">({selectedIniFiles.map(f => f.filename).join(', ')})</span>
          </div>
          <button
            onClick={() => setSelectedIniFiles([])}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            title="Detach INI Templates"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Drawer Popout */}
      {showUploadDrawer && (
        <div className="mb-3 bg-[#242424] border border-gray-700 p-4 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300">Attach Excel Workbook</span>
            <button
              onClick={() => setShowUploadDrawer(false)}
              className="text-gray-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Upload onSuccess={() => setShowUploadDrawer(false)} />
        </div>
      )}

      {/* Main Input Box */}
      <div className="relative flex items-end bg-[#2f2f2f] border border-gray-600 focus-within:border-gray-400 rounded-2xl shadow-lg transition-colors overflow-hidden p-1.5">
        <div className="flex items-center pb-1 pl-1 gap-1">
          {/* File Attachment Icon */}
          <button
            type="button"
            onClick={() => setShowUploadDrawer(!showUploadDrawer)}
            className={`p-2 rounded-xl transition-colors ${
              showUploadDrawer || uploadedExcel ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title="Upload Excel workbook (.xlsx)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Template Selector Button */}
          <button
            type="button"
            onClick={() => setOneDriveModalOpen(true)}
            className="p-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-xl transition-colors inline-flex"
            title="Select Template from Folder"
          >
            <FolderTree className="w-5 h-5" />
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
          className="flex-1 max-h-[180px] bg-transparent text-gray-100 placeholder-gray-400 text-sm focus:outline-none resize-none py-2.5 px-3 leading-relaxed font-sans"
        />

        {/* Send Button */}
        <div className="pb-1 pr-1">
          <button
            type="button"
            onClick={handleSend}
            disabled={(!input.trim() && selectedIniFiles.length === 0) || isGenerating}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${
              (input.trim() || selectedIniFiles.length > 0) && !isGenerating
                ? 'bg-white text-black hover:bg-gray-200 shadow cursor-pointer'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            title="Send Message to LangGraph Orchestrator"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 px-1">
        <span>INI Agent uses LangGraph multi-step reasoning • OneDrive repository is Read-Only</span>
        <div className="flex gap-2">
          <button onClick={() => setInput("Create Partner A 850 INI")} className="hover:text-gray-300 underline">Partner A 850</button>
          <span>•</span>
          <button onClick={() => setInput("Generate Partner B 856 INI")} className="hover:text-gray-300 underline">Partner B 856</button>
        </div>
      </div>
    </div>
  );
});
