import React, { useState, useEffect } from 'react';
import { X, Folder, FileText, Search, Lock, ShieldAlert } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

interface IniTemplate {
  path: string;
  folder: string;
  filename: string;
  content: string;
}

export const OneDriveModal: React.FC = () => {
  const [templates, setTemplates] = useState<IniTemplate[]>([]);
  const [oneDriveLink, setOneDriveLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<IniTemplate | null>(null);

  const isOpen = useChatStore(s => s.isOneDriveModalOpen);
  const setOpen = useChatStore(s => s.setOneDriveModalOpen);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/onedrive/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
      if (data.link) {
        setOneDriveLink(data.link);
      }
      if (data.templates && data.templates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data.templates[0]);
      }
    } catch (err) {
      console.error('Failed fetching OneDrive templates:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filtered = templates.filter(t => 
    t.path.toLowerCase().includes(search.toLowerCase()) ||
    t.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-gray-700 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#252525] border-b border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                OneDrive INI Template Repository
                <span className="text-[10px] font-mono px-2 py-0.5 bg-red-950/60 text-red-300 border border-red-900/50 rounded flex items-center gap-1">
                  <Lock className="w-3 h-3" /> READ ONLY
                </span>
              </h2>
              <p className="text-xs text-blue-400 font-mono mt-0.5 truncate max-w-xl">
                Source URL: {oneDriveLink ? <a href={oneDriveLink} target="_blank" rel="noopener noreferrer" className="hover:underline">{oneDriveLink}</a> : 'Loaded from ONEDRIVE_TEMPLATES_LINK in .env'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Templates Warning Banner */}
        <div className="bg-amber-950/30 px-6 py-2 border-b border-amber-900/40 text-xs text-amber-300 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Reading INIs via shared URL. Excel master schema templates are loaded from <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200 font-mono">/excel_templates</code>.
            </span>
          </div>
          <span className="text-[11px] text-gray-400">No write access permitted</span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left File List */}
          <div className="w-72 sm:w-80 border-r border-gray-800 bg-[#181818] flex flex-col shrink-0">
            {/* Search Box */}
            <div className="p-3 border-b border-gray-800">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-[#242424] text-xs text-gray-200 placeholder-gray-500 pl-9 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="p-8 text-center text-xs text-gray-500">Loading OneDrive files...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">No *.ini templates matched</div>
              ) : (
                filtered.map(t => {
                  const isSelected = selectedTemplate?.path === t.path;
                  return (
                    <div
                      key={t.path}
                      onClick={() => setSelectedTemplate(t)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-colors flex items-start gap-2.5 ${
                        isSelected ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-[#222222]'
                      }`}
                    >
                      <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold font-mono truncate">{t.filename}</div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                          Folder: {t.folder}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Preview Area */}
          <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
            {selectedTemplate ? (
              <>
                <div className="px-6 py-3 bg-[#222222] border-b border-gray-800 flex items-center justify-between font-mono text-xs text-gray-300">
                  <span>OneDrive / {selectedTemplate.path}</span>
                  <span className="text-gray-500">{selectedTemplate.content.length} Bytes</span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-gray-200 whitespace-pre leading-relaxed bg-[#191919]">
                  {selectedTemplate.content}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
                Select a template from the OneDrive hierarchy
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#252525] border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <span>OneDrive Link Mode • Excel Templates Folder: <code className="text-blue-300 font-mono">/excel_templates</code></span>
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            Close Explorer
          </button>
        </div>
      </div>
    </div>
  );
};
