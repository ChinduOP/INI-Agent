import { create } from 'zustand';
import { Attachment, ChatMessage, GeneratedIniResult, GraphTraceEvent } from '../../server/graph/state.js';

export interface TemplateFileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'ini' | 'sql';
  content?: string;
  children?: TemplateFileNode[];
  isOpen?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  uploadedExcel: { path: string; name: string } | null;
}

interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isSidebarCollapsed: boolean;
  isUploading: boolean;
  isGenerating: boolean;
  generatingSessionId: string | null;
  uploadingSessionId: string | null;
  isOneDriveModalOpen: boolean;
  selectedIniFiles: { filename: string; path: string; content: string }[];
  activeView: 'chat' | 'templates';
  fileSystem: TemplateFileNode[];
  templateFolderPath: string;
  
  // Actions
  createNewSession: () => void;
  setActiveSession: (id: string) => void;
  setActiveView: (view: 'chat' | 'templates') => void;
  toggleSidebar: () => void;
  setOneDriveModalOpen: (open: boolean) => void;
  setSelectedIniFiles: (files: { filename: string; path: string; content: string }[]) => void;
  setFileSystem: (fs: TemplateFileNode[]) => void;
  setTemplateFolderPath: (path: string) => void;
  loadLocalTemplates: (path?: string) => Promise<void>;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  setUploadedExcel: (sessionId: string, file: { path: string; name: string } | null) => void;
  setUploading: (uploading: boolean, sessionId?: string) => void;
  setGenerating: (generating: boolean, sessionId?: string) => void;
  deleteSession: (id: string) => void;
}

const initialTemplateFiles: TemplateFileNode[] = [];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_1',
  role: 'assistant',
  timestamp: Date.now(),
  content: `Hello 👋\n\nI'm your INI Agent.\n\nI can:\n\n• Analyze uploaded Excel files\n• Read Modules, EDI and Document sheets\n• Search your custom template repository\n• Choose the best matching INI template\n• Generate production-ready INI files\n• Preserve template formatting\n• Validate generated configuration\n\nUpload an Excel file to begin.`
};

export const useChatStore = create<ChatStore>((set, get) => {
  const initialSessionId = 'session_' + Date.now();
  const initialSession: ChatSession = {
    id: initialSessionId,
    title: 'New INI Generation Chat',
    createdAt: Date.now(),
    messages: [INITIAL_WELCOME_MESSAGE],
    uploadedExcel: null
  };

  return {
    sessions: [initialSession],
    activeSessionId: initialSessionId,
    isSidebarCollapsed: false,
    isUploading: false,
    isGenerating: false,
    generatingSessionId: null,
    uploadingSessionId: null,
    isOneDriveModalOpen: false,
    selectedIniFiles: [],
    activeView: 'chat',
    fileSystem: initialTemplateFiles,
    templateFolderPath: 'ini_templates',

    setTemplateFolderPath: (path: string) => {
      set({ templateFolderPath: path });
    },

    loadLocalTemplates: async (pathOverride?: string) => {
      let folderPath = pathOverride !== undefined ? pathOverride : get().templateFolderPath;
      
      // If we are using the default and haven't fetched from server yet, let's fetch config first!
      if (pathOverride === undefined && get().templateFolderPath === 'ini_templates') {
        try {
          const configRes = await fetch('/api/templates/config');
          if (configRes.ok) {
            const configResult = await configRes.json();
            if (configResult.success && configResult.defaultDir) {
              folderPath = configResult.defaultDir;
              set({ templateFolderPath: folderPath });
            }
          }
        } catch (configErr) {
          console.error("Error fetching template config:", configErr);
        }
      }

      try {
        const res = await fetch(`/api/templates/list?dir=${encodeURIComponent(folderPath)}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            set({ fileSystem: result.data });
          }
        }
      } catch (err) {
        console.error("Error loading templates in chatStore:", err);
      }
    },

    createNewSession: () => {
      const newId = 'session_' + Date.now();
      const newSession: ChatSession = {
        id: newId,
        title: 'New INI Generation Chat',
        createdAt: Date.now(),
        messages: [{ ...INITIAL_WELCOME_MESSAGE, id: 'welcome_' + Date.now() }],
        uploadedExcel: null
      };

      set(state => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newId,
        activeView: 'chat'
      }));
    },

    setActiveSession: (id: string) => {
      set({ activeSessionId: id, activeView: 'chat' });
    },
    
    setActiveView: (view: 'chat' | 'templates') => {
      set({ activeView: view });
    },

    toggleSidebar: () => {
      set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
    },

    setOneDriveModalOpen: (open: boolean) => {
      set({ isOneDriveModalOpen: open });
    },

    setSelectedIniFiles: (files) => {
      set({ selectedIniFiles: files });
    },

    setFileSystem: (fs: TemplateFileNode[]) => {
      set({ fileSystem: fs });
    },

    addMessage: (sessionId: string, message: ChatMessage) => {
      set(state => {
        const updatedSessions = state.sessions.map(s => {
          if (s.id !== sessionId) return s;
          
          // Auto update title if first user message
          let newTitle = s.title;
          if (s.title === 'New INI Generation Chat' && message.role === 'user') {
            newTitle = message.content.slice(0, 28) + (message.content.length > 28 ? '...' : '');
          }

          return {
            ...s,
            title: newTitle,
            messages: [...s.messages, message]
          };
        });
        return { sessions: updatedSessions };
      });
    },

    setUploadedExcel: (sessionId: string, file: { path: string; name: string } | null) => {
      set(state => ({
        sessions: state.sessions.map(s => s.id === sessionId ? { ...s, uploadedExcel: file } : s)
      }));
    },

    setUploading: (uploading: boolean, sessionId?: string) => {
      set(state => ({ 
        isUploading: uploading,
        uploadingSessionId: uploading ? (sessionId || state.activeSessionId) : null
      }));
    },

    setGenerating: (generating: boolean, sessionId?: string) => {
      set(state => ({ 
        isGenerating: generating,
        generatingSessionId: generating ? (sessionId || state.activeSessionId) : null
      }));
    },

    deleteSession: (id: string) => {
      set(state => {
        const remaining = state.sessions.filter(s => s.id !== id);
        if (remaining.length === 0) {
          const newId = 'session_' + Date.now();
          return {
            sessions: [{
              id: newId,
              title: 'New INI Generation Chat',
              createdAt: Date.now(),
              messages: [{ ...INITIAL_WELCOME_MESSAGE, id: 'welcome_' + Date.now() }],
              uploadedExcel: null
            }],
            activeSessionId: newId
          };
        }
        return {
          sessions: remaining,
          activeSessionId: state.activeSessionId === id ? remaining[0].id : state.activeSessionId
        };
      });
    }
  };
});
