import React from 'react';
import { Bot, User, FileSpreadsheet, Sparkles } from 'lucide-react';
import { ChatMessage } from '../../server/graph/state.js';
import { NotepadViewer } from './NotepadViewer';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  // Helper to format text markdown bullet points nicely
  const renderFormattedContent = (content: string) => {
    const paragraphs = content.split('\n\n');
    return paragraphs.map((para, i) => {
      const lines = para.split('\n');
      return (
        <div key={i} className="mb-3 last:mb-0 text-[14.5px] leading-relaxed text-gray-100">
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              return (
                <div key={lIdx} className="flex items-start gap-2.5 my-1.5 pl-1 text-gray-200">
                  <span className="text-blue-400 font-bold leading-none mt-1.5">•</span>
                  <span>{trimmed.replace(/^[•*\-]\s*/, '')}</span>
                </div>
              );
            }
            if (trimmed.startsWith('>')) {
              return (
                <blockquote key={lIdx} className="border-l-4 border-blue-500 pl-4 py-1 my-2 bg-blue-950/20 text-gray-200 italic rounded-r">
                  {trimmed.replace(/^>\s*/, '')}
                </blockquote>
              );
            }
            // Simple bold bold parsing (`**text**` or `*text*` or `\`code\``)
            const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
            return (
              <p key={lIdx} className="my-1">
                {parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                  }
                  if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={pIdx} className="bg-black/50 px-1.5 py-0.5 rounded font-mono text-xs text-blue-300 border border-gray-800">{part.slice(1, -1)}</code>;
                  }
                  return part;
                })}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className={`w-full py-6 px-4 sm:px-6 flex gap-4 transition-colors ${
      isAssistant ? 'bg-[#212121]' : 'bg-[#181818] flex-row-reverse'
    }`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white shadow-md ${
        isAssistant 
          ? 'bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-blue-500/30' 
          : 'bg-gray-700'
      }`}>
        {isAssistant ? (
          <Bot className="w-5 h-5" />
        ) : (
          <User className="w-4 h-4 text-gray-200" />
        )}
      </div>

      {/* Content Container */}
      <div className={`flex-1 overflow-hidden pt-0.5 flex flex-col ${isAssistant ? '' : 'items-end'} w-full max-w-full`}>
        <div className={`flex items-center gap-2 mb-1.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
          <span className="text-xs font-semibold tracking-wide text-gray-300">
            {isAssistant ? 'INI Agent' : 'You'}
          </span>
          {isAssistant && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono border border-blue-500/20">
              <Sparkles className="w-2.5 h-2.5" /> LangGraph Orchestrated
            </span>
          )}
        </div>

        {/* Message body */}
        <div className={`text-gray-100 font-sans break-words ${isAssistant ? '' : 'text-right'}`}>
          {renderFormattedContent(message.content)}
        </div>

        {/* Attachments Tag */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <div key={i} className="inline-flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-md text-xs text-gray-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium font-mono">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Generated INI Viewer */}
        {message.generatedInis && message.generatedInis.length > 0 && (
          <NotepadViewer results={message.generatedInis} />
        )}
        {!message.generatedInis && message.generatedIni && (
          <NotepadViewer results={[message.generatedIni]} />
        )}
      </div>
    </div>
  );
};
