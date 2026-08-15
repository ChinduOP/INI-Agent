/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { TemplateManagerPage } from './components/TemplateManagerPage';
import { OneDriveModal } from './components/OneDriveModal';
import { useChatStore } from './store/chatStore';

export default function App() {
  const activeView = useChatStore(s => s.activeView);
  const setTemplateFolderPath = useChatStore(s => s.setTemplateFolderPath);
  const loadLocalTemplates = useChatStore(s => s.loadLocalTemplates);

  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const configRes = await fetch('/api/templates/config');
        if (configRes.ok) {
          const configResult = await configRes.json();
          if (configResult.success && configResult.defaultDir) {
            setTemplateFolderPath(configResult.defaultDir);
            await loadLocalTemplates(configResult.defaultDir);
          }
        }
      } catch (err) {
        console.error("Error initializing template folder configuration:", err);
      }
    };
    initializeConfig();
  }, [setTemplateFolderPath, loadLocalTemplates]);

  return (
    <div className="flex h-screen w-screen bg-[#212121] text-gray-100 font-sans overflow-hidden antialiased">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {activeView === 'templates' ? (
          <TemplateManagerPage />
        ) : (
          <ChatWindow />
        )}
      </main>
      <OneDriveModal />
    </div>
  );
}
