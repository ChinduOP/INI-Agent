import React, { useState, useMemo } from 'react';
import { X, Folder, FileText, FileCode, Search, ChevronRight, CheckSquare, Square, LayoutTemplate, ClipboardList, Check } from 'lucide-react';
import { useChatStore, TemplateFileNode } from '../store/chatStore';
import { isXmlFieldSelectionAvailable } from '../utils/xmlParser';
import { XmlFormSelectionModal } from './XmlFormSelectionModal';

interface IniTemplate {
  path: string;
  folder: string;
  filename: string;
  content: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: Record<string, FileNode>;
  fileData?: IniTemplate;
}

const flattenFileSystem = (nodes: TemplateFileNode[], parentPath = ""): IniTemplate[] => {
  let list: IniTemplate[] = [];
  nodes.forEach(node => {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.type === 'file') {
      list.push({
        path: currentPath,
        folder: parentPath,
        filename: node.name,
        content: node.content || ''
      });
    } else if (node.type === 'folder' && node.children) {
      list.push(...flattenFileSystem(node.children, currentPath));
    }
  });
  return list;
};

export const OneDriveModal: React.FC = () => {
  const [search, setSearch] = useState('');
  
  // Navigation & Selection
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<IniTemplate | null>(null);

  // Custom XML Fields State: path -> array of selected field IDs
  const [customXmlFields, setCustomXmlFields] = useState<Record<string, string[]>>({});
  const [editingXmlFile, setEditingXmlFile] = useState<IniTemplate | null>(null);

  const isOpen = useChatStore(s => s.isOneDriveModalOpen);
  const setOpen = useChatStore(s => s.setOneDriveModalOpen);
  const setSelectedIniFiles = useChatStore(s => s.setSelectedIniFiles);
  const fileSystem = useChatStore(s => s.fileSystem);
  const loadLocalTemplates = useChatStore(s => s.loadLocalTemplates);
  const templateFolderPath = useChatStore(s => s.templateFolderPath);

  React.useEffect(() => {
    if (isOpen) {
      loadLocalTemplates();
    }
  }, [isOpen, loadLocalTemplates]);

  const templates = useMemo(() => {
    return flattenFileSystem(fileSystem);
  }, [fileSystem]);

  const fileTree = useMemo(() => {
    const root: FileNode = { name: 'root', path: '', type: 'folder', children: {} };
    templates.forEach(t => {
      const parts = t.path.split('/');
      let current = root;
      parts.forEach((part, i) => {
        const isFile = i === parts.length - 1;
        const path = parts.slice(0, i + 1).join('/');
        if (!current.children![part]) {
          current.children![part] = {
            name: part,
            path,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : {},
            fileData: isFile ? t : undefined
          };
        }
        current = current.children![part];
      });
    });
    return root;
  }, [templates]);

  const currentFolder = useMemo(() => {
    let current = fileTree;
    for (const part of currentPath) {
      if (current.children && current.children[part]) {
        current = current.children[part];
      }
    }
    return current;
  }, [fileTree, currentPath]);

  const toggleSelect = (node: FileNode, forceState?: boolean) => {
    const newSelected = new Set(selectedPaths);
    const select = forceState !== undefined ? forceState : !newSelected.has(node.path);

    const updateSelection = (n: FileNode) => {
      if (select) newSelected.add(n.path);
      else newSelected.delete(n.path);
      if (n.children) {
        Object.values(n.children).forEach(updateSelection);
      }
    };
    
    updateSelection(node);
    setSelectedPaths(newSelected);
  };

  const folderContents = useMemo(() => {
    if (search) {
      const results: FileNode[] = [];
      const searchRecursive = (node: FileNode) => {
        if (node.type === 'file' && node.name.toLowerCase().includes(search.toLowerCase())) {
          results.push(node);
        }
        if (node.children) {
          Object.values(node.children).forEach(searchRecursive);
        }
      };
      searchRecursive(fileTree);
      return results;
    }
    return (Object.values(currentFolder.children || {}) as FileNode[]).sort((a, b) => 
      (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1) || a.name.localeCompare(b.name)
    );
  }, [fileTree, currentFolder, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
              Select Custom Template from Template Manager
            </h2>
          </div>
          <button 
            onClick={() => setOpen(false)} 
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200/70 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: File Explorer */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#181818] overflow-y-auto p-4 font-mono text-xs flex flex-col">
            {/* Search Box */}
            <div className="mb-4">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-white dark:bg-[#242424] text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Breadcrumbs */}
            <div className="mb-4 flex items-center gap-1 text-gray-600 dark:text-gray-400 font-sans text-xs">
              <button className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-medium" onClick={() => setCurrentPath([])}>Root</button>
              {currentPath.map((part, i) => (
                <React.Fragment key={part}>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                  <button className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-medium" onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}>{part}</button>
                </React.Fragment>
              ))}
            </div>

            {/* List */}
            <div className="space-y-1 select-none">
              {!search && folderContents.length > 0 && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222222] p-2 rounded mb-2 border-b border-gray-200 dark:border-gray-800">
                  <button onClick={() => toggleSelect(currentFolder, !folderContents.every(node => selectedPaths.has(node.path)))} className="cursor-pointer">
                    {folderContents.every(node => selectedPaths.has(node.path)) ? <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Square className="w-4 h-4 text-gray-400" />}
                  </button>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold cursor-pointer font-sans" onClick={() => toggleSelect(currentFolder, !folderContents.every(node => selectedPaths.has(node.path)))}>Select All</span>
                </div>
              )}
              {folderContents.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8 font-sans">No templates found</div>
              ) : (
                folderContents.map(node => (
                  <div key={node.path} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222222] p-1.5 rounded transition-colors group">
                    <button onClick={() => toggleSelect(node)} className="cursor-pointer">
                      {selectedPaths.has(node.path) ? <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Square className="w-4 h-4 text-gray-400" />}
                    </button>
                    <div 
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        if (node.type === 'folder') {
                          setCurrentPath([...currentPath, node.name]);
                        } else if (node.fileData) {
                          setPreviewFile(node.fileData);
                        }
                      }}
                    >
                      {node.type === 'folder' ? (
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : node.name.toLowerCase().endsWith('.xml') ? (
                        <FileCode className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      )}
                      <span className="truncate">{node.name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Preview Area */}
          <div className="w-2/3 bg-white dark:bg-[#1a1a1a] flex flex-col overflow-hidden">
            {selectedPaths.size > 0 ? (
              <div className="flex-1 p-6 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 font-sans">Selected Files ({selectedPaths.size}):</h3>
                <ul className="space-y-2">
                  {templates.filter(t => selectedPaths.has(t.path)).map(t => {
                    const isXml = isXmlFieldSelectionAvailable(t.path);
                    const hasCustomFields = customXmlFields[t.path] && customXmlFields[t.path].length > 0;

                    return (
                      <li key={t.path} className="text-xs text-indigo-700 dark:text-indigo-300 font-mono flex items-center justify-between bg-indigo-50/70 dark:bg-[#222222] p-2.5 rounded border border-indigo-200/70 dark:border-gray-800">
                        <div className="flex items-center gap-2 truncate">
                          {isXml ? (
                            <FileCode className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                          )}
                          <span className="truncate">{t.filename}</span>
                        </div>

                        {/* Form selector for selected XML templates, including DCP XMLs */}
                        {isXml && (
                          <button
                            onClick={() => setEditingXmlFile(t)}
                            title={hasCustomFields ? 'Custom XML fields configured' : 'Configure XML form fields'}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans transition-all cursor-pointer shrink-0 ${
                              hasCustomFields
                                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 shadow-2xs'
                                : 'bg-white dark:bg-[#181818] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <ClipboardList className={`w-3.5 h-3.5 ${hasCustomFields ? 'text-emerald-500' : 'text-indigo-500'}`} />
                            {hasCustomFields ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                                <span className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">Custom</span>
                              </>
                            ) : (
                              <span className="font-medium text-[11px]">Form</span>
                            )}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : previewFile ? (
              <>
                <div className="px-6 py-3 bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between font-mono text-xs text-indigo-700 dark:text-indigo-300">
                  <span className="truncate">{previewFile.path}</span>

                  {/* Form Icon for Validation XML in Single File Selected View at Top Right */}
                  {isXmlFieldSelectionAvailable(previewFile.path) && (
                    <button
                      onClick={() => setEditingXmlFile(previewFile)}
                      title={
                        customXmlFields[previewFile.path] && customXmlFields[previewFile.path].length > 0
                          ? 'Custom XML fields configured'
                          : 'Configure XML form fields'
                      }
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-sans transition-all cursor-pointer shrink-0 ${
                        customXmlFields[previewFile.path] && customXmlFields[previewFile.path].length > 0
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 shadow-2xs'
                          : 'bg-white dark:bg-[#282828] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <ClipboardList className={`w-3.5 h-3.5 ${customXmlFields[previewFile.path] && customXmlFields[previewFile.path].length > 0 ? 'text-emerald-500' : 'text-indigo-500'}`} />
                      {customXmlFields[previewFile.path] && customXmlFields[previewFile.path].length > 0 ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                          <span className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">Custom</span>
                        </>
                      ) : (
                        <span className="font-medium text-[11px]">Form</span>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre leading-relaxed bg-gray-50/30 dark:bg-[#141414]">
                  {previewFile.content}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-gray-500 dark:text-gray-400 p-8 text-center font-sans">
                <LayoutTemplate className="w-8 h-8 text-gray-400 dark:text-gray-600 mb-2" />
                Select a template file to preview or check multiple to select for generation
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-[#202020] border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 text-xs">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={() => {
              const files = templates.filter(t => selectedPaths.has(t.path)).map(t => ({
                ...t,
                selectedFields: Object.prototype.hasOwnProperty.call(customXmlFields, t.path)
                  ? customXmlFields[t.path]
                  : undefined
              }));
              setSelectedIniFiles(files);
              setOpen(false);
            }}
            disabled={selectedPaths.size === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg disabled:opacity-50 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            Select {selectedPaths.size} {selectedPaths.size === 1 ? 'Template' : 'Templates'}
          </button>
        </div>
      </div>

      {/* XML Form Field Selection Modal */}
      <XmlFormSelectionModal
        isOpen={!!editingXmlFile}
        file={editingXmlFile}
        initialSelectedFields={editingXmlFile ? customXmlFields[editingXmlFile.path] : undefined}
        onClose={() => setEditingXmlFile(null)}
        onSave={(fields) => {
          if (editingXmlFile) {
            setCustomXmlFields(prev => ({
              ...prev,
              [editingXmlFile.path]: fields
            }));
          }
        }}
      />
    </div>
  );
};

export default OneDriveModal;
