import { create } from 'zustand';
import { Attachment, ChatMessage, GeneratedIniResult, GraphTraceEvent } from '../../server/graph/state.js';

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
  isOneDriveModalOpen: boolean;
  
  // Actions
  createNewSession: () => void;
  setActiveSession: (id: string) => void;
  toggleSidebar: () => void;
  setOneDriveModalOpen: (open: boolean) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  setUploadedExcel: (sessionId: string, file: { path: string; name: string } | null) => void;
  setUploading: (uploading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  deleteSession: (id: string) => void;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_1',
  role: 'assistant',
  timestamp: Date.now(),
  content: `Hello 👋\n\nI'm your INI Agent.\n\nI can:\n\n• Analyze uploaded Excel files\n• Read Modules, EDI and Document sheets\n• Search your OneDrive template repository\n• Choose the best matching INI template\n• Generate production-ready INI files\n• Preserve template formatting\n• Validate generated configuration\n\nUpload an Excel file to begin.`
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
    isOneDriveModalOpen: false,

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
        activeSessionId: newId
      }));
    },

    setActiveSession: (id: string) => {
      set({ activeSessionId: id });
    },

    toggleSidebar: () => {
      set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
    },

    setOneDriveModalOpen: (open: boolean) => {
      set({ isOneDriveModalOpen: open });
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

    setUploading: (uploading: boolean) => {
      set({ isUploading: uploading });
    },

    setGenerating: (generating: boolean) => {
      set({ isGenerating: generating });
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
