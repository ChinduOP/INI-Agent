import React from 'react';
import { Bot, User, FileSpreadsheet, Sparkles } from 'lucide-react';
import { ChatMessage } from '../../server/graph/state.js';
import { NotepadViewer } from './NotepadViewer';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  // Inline markdown parser that turns **text** into styled bold, `code` into code badge, and *text* into italic
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={pIdx} className="font-bold text-gray-900 dark:text-white tracking-wide">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={pIdx}
            className="bg-sky-100/70 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono text-[13px] border border-sky-300/60 dark:border-sky-800/40 shadow-xs mx-0.5"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={pIdx} className="italic text-gray-600 dark:text-gray-400">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  // Helper to format text markdown bullet points and status banners nicely
  const renderFormattedContent = (content: string) => {
    // Merge any orphan bullets followed immediately by text on next line
    const normalizedContent = content.replace(/^[•*\-]\s*\n+([^\n]+)/gm, '• $1');
    const paragraphs = normalizedContent.split('\n\n');

    return paragraphs.map((para, i) => {
      const lines = para.split('\n');
      return (
        <div key={i} className="mb-3 last:mb-0 text-[14.5px] leading-relaxed text-gray-800 dark:text-gray-200">
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            // Success or Failure banner header styling
            if (trimmed.startsWith('✅')) {
              return (
                <div
                  key={lIdx}
                  className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 font-bold text-[15px] py-2 px-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-lg my-2 shadow-xs"
                >
                  <span className="leading-snug">{renderInlineMarkdown(trimmed)}</span>
                </div>
              );
            }

            if (trimmed.startsWith('❌')) {
              return (
                <div
                  key={lIdx}
                  className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400 font-bold text-[15px] py-2 px-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-lg my-2 shadow-xs"
                >
                  <span className="leading-snug">{renderInlineMarkdown(trimmed)}</span>
                </div>
              );
            }

            // Bullet items
            if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              const itemContent = trimmed.replace(/^[•*\-]\s*/, '');
              return (
                <div key={lIdx} className="flex items-start gap-2.5 my-1.5 pl-1 text-gray-700 dark:text-gray-300">
                  <span className="text-sky-600 dark:text-sky-400 font-bold leading-none mt-1 select-none text-base">•</span>
                  <div className="leading-relaxed flex-1 text-[14.5px]">
                    {renderInlineMarkdown(itemContent)}
                  </div>
                </div>
              );
            }

            // Blockquote
            if (trimmed.startsWith('>')) {
              return (
                <blockquote
                  key={lIdx}
                  className="border-l-4 border-sky-400 dark:border-sky-500 pl-4 py-1.5 my-2 bg-sky-50 dark:bg-sky-950/20 text-gray-700 dark:text-gray-300 italic rounded-r"
                >
                  {renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
                </blockquote>
              );
            }

            // Standard line/paragraph
            return (
              <p key={lIdx} className="my-1 text-gray-800 dark:text-gray-200 leading-relaxed text-[14.5px]">
                {renderInlineMarkdown(trimmed)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className={`w-full py-6 px-4 sm:px-6 flex gap-4 transition-colors ${
      isAssistant ? 'bg-transparent' : 'bg-gray-50/70 dark:bg-[#181818]/60 flex-row-reverse border-y border-gray-100 dark:border-gray-800/40'
    }`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-md ${
        isAssistant 
          ? 'bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-blue-500/30 text-white' 
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
      }`}>
        {isAssistant ? (
          <Bot className="w-5 h-5 !text-white text-white" />
        ) : (
          <User className="w-4 h-4" />
        )}
      </div>

      {/* Content Container */}
      <div className={`flex-1 overflow-hidden pt-0.5 flex flex-col ${isAssistant ? '' : 'items-end'} w-full max-w-full`}>
        <div className={`flex items-center gap-2 mb-1.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
          <span className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">
            {isAssistant ? 'INI Agent' : 'You'}
          </span>
          {isAssistant && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-mono border border-blue-200 dark:border-blue-800/60 font-semibold">
              <Sparkles className="w-2.5 h-2.5" /> LangGraph Orchestrated
            </span>
          )}
        </div>

        {/* Message body */}
        <div className={`font-sans break-words ${isAssistant ? 'text-gray-800 dark:text-gray-200' : 'text-right text-gray-900 dark:text-gray-100 font-medium'}`}>
          {renderFormattedContent(message.content)}
        </div>

        {/* Attachments Tag */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <div key={i} className="inline-flex items-center gap-1.5 bg-white dark:bg-[#202020] border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-700 dark:text-gray-300 shadow-xs">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
