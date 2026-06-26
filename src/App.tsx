/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { OneDriveModal } from './components/OneDriveModal';

export default function App() {
  return (
    <div className="flex h-screen w-screen bg-[#212121] text-gray-100 font-sans overflow-hidden antialiased">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        <ChatWindow />
      </main>
      <OneDriveModal />
    </div>
  );
}
