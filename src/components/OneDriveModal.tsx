import React, { useState, useMemo } from 'react';
import { X, Folder, FileText, Search, ChevronRight, CheckSquare, Square, LayoutTemplate } from 'lucide-react';
import { useChatStore, TemplateFileNode } from '../store/chatStore';

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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-gray-700 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#252525] border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Select Custom Template from Template Manager
            </h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: File Explorer */}
          <div className="w-1/3 border-r border-gray-700 bg-[#181818] overflow-y-auto p-4 font-mono text-xs flex flex-col">
            {/* Search Box */}
            <div className="mb-4">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-[#242424] text-xs text-gray-200 placeholder-gray-500 pl-9 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Breadcrumbs */}
            <div className="mb-4 flex items-center gap-1 text-gray-400 font-sans text-xs">
              <button className="hover:text-indigo-400 cursor-pointer font-medium" onClick={() => setCurrentPath([])}>Root</button>
              {currentPath.map((part, i) => (
                <React.Fragment key={part}>
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                  <button className="hover:text-indigo-400 cursor-pointer font-medium" onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}>{part}</button>
                </React.Fragment>
              ))}
            </div>

            {/* List */}
            <div className="space-y-1 select-none">
              {!search && folderContents.length > 0 && (
                <div className="flex items-center gap-2 text-gray-300 hover:bg-[#222222] p-2 rounded mb-2 border-b border-gray-800">
                  <button onClick={() => toggleSelect(currentFolder, !folderContents.every(node => selectedPaths.has(node.path)))}>
                    {folderContents.every(node => selectedPaths.has(node.path)) ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-gray-600" />}
                  </button>
                  <span className="text-xs text-gray-400 font-semibold cursor-pointer font-sans" onClick={() => toggleSelect(currentFolder, !folderContents.every(node => selectedPaths.has(node.path)))}>Select All</span>
                </div>
              )}
              {folderContents.length === 0 ? (
                <div className="text-gray-500 text-center py-8 font-sans">No templates found</div>
              ) : (
                folderContents.map(node => (
                  <div key={node.path} className="flex items-center gap-2 text-gray-300 hover:bg-[#222222] p-1.5 rounded transition-colors group">
                    <button onClick={() => toggleSelect(node)}>
                      {selectedPaths.has(node.path) ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-gray-600" />}
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
                      {node.type === 'folder' ? <Folder className="w-4 h-4 text-amber-500 shrink-0" /> : <FileText className="w-4 h-4 text-indigo-400 shrink-0" />}
                      <span className="truncate">{node.name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Preview Area */}
          <div className="w-2/3 bg-[#1e1e1e] flex flex-col overflow-hidden">
            {selectedPaths.size > 1 ? (
              <div className="flex-1 p-6 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-300 mb-4 font-sans">Selected Files ({selectedPaths.size}):</h3>
                <ul className="space-y-2">
                  {templates.filter(t => selectedPaths.has(t.path)).map(t => (
                    <li key={t.path} className="text-xs text-indigo-300 font-mono flex items-center gap-2 bg-[#181818] p-2 rounded border border-gray-800">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      {t.filename}
                    </li>
                  ))}
                </ul>
              </div>
            ) : previewFile ? (
              <>
                <div className="px-6 py-3 bg-[#222222] border-b border-gray-800 flex items-center justify-between font-mono text-xs text-indigo-300">
                  <span className="truncate">{previewFile.path}</span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-gray-300 whitespace-pre leading-relaxed bg-[#141414]">
                  {previewFile.content}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-gray-500 p-8 text-center font-sans">
                <LayoutTemplate className="w-8 h-8 text-gray-700 mb-2" />
                Select a template file to preview or check multiple to select for generation
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#252525] border-t border-gray-700 flex justify-end gap-3 text-xs">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
          <button
            onClick={() => {
              const files = templates.filter(t => selectedPaths.has(t.path));
              setSelectedIniFiles(files);
              setOpen(false);
            }}
            disabled={selectedPaths.size === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg disabled:opacity-50 transition-all shadow-md"
          >
            Select {selectedPaths.size} {selectedPaths.size === 1 ? 'Template' : 'Templates'}
          </button>
        </div>
      </div>
    </div>
  );
};
