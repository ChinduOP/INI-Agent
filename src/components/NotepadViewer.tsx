import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check, FileText, AlertTriangle, AlertCircle } from 'lucide-react';
import { DownloadButton } from './DownloadButton';
import { GeneratedIniResult } from '../../server/graph/state.js';

interface NotepadViewerProps {
  result: GeneratedIniResult;
}

export const NotepadViewer: React.FC<NotepadViewerProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const { validationSummary } = result;

  return (
    <div id={`ini-viewer-${result.filename}`} className="my-4 border border-gray-700 rounded-lg overflow-hidden bg-[#1e1e1e] shadow-lg max-w-full">
      {/* Top Banner with exact requested notepad header styling */}
      <div className="bg-[#2d2d2d] px-4 py-2.5 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2 text-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="font-mono text-sm font-semibold text-white tracking-wide">{result.filename}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors border border-gray-600"
            title="Copy INI text to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <DownloadButton filename={result.filename} content={result.content} />
        </div>
      </div>

      {/* Validation Summary Bar */}
      <div className={`px-4 py-2 text-xs flex items-center justify-between border-b border-gray-800 ${
        validationSummary.isValid ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/40 text-amber-300'
      }`}>
        <div className="flex items-center gap-2">
          {validationSummary.isValid ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>
            {validationSummary.isValid 
              ? `LangGraph Validator: Configuration passed integrity checks.`
              : `LangGraph Validator: Found ${validationSummary.errors.length} syntax errors.`}
            {validationSummary.todoCount > 0 && ` (${validationSummary.todoCount} TODO fields requiring manual assignment)`}
          </span>
        </div>

        {(validationSummary.errors.length > 0 || validationSummary.warnings.length > 0) && (
          <button
            onClick={() => setShowValidationDetails(!showValidationDetails)}
            className="underline hover:text-white font-medium"
          >
            {showValidationDetails ? 'Hide Audit Log' : 'View Audit Log'}
          </button>
        )}
      </div>

      {/* Audit Log Dropdown */}
      {showValidationDetails && (
        <div className="bg-black/60 px-4 py-3 text-xs border-b border-gray-800 max-h-40 overflow-y-auto space-y-1.5 font-mono">
          {validationSummary.errors.map((err, i) => (
            <div key={`err-${i}`} className="text-red-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ))}
          {validationSummary.warnings.map((warn, i) => (
            <div key={`warn-${i}`} className="text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Monaco Code Editor (Notepad style) */}
      <div className="h-[360px] w-full">
        <Editor
          height="100%"
          defaultLanguage="ini"
          theme="vs-dark"
          value={result.content}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 }
          }}
        />
      </div>

      {/* Bottom status footer */}
      <div className="bg-[#252525] px-4 py-1.5 text-[11px] font-mono text-gray-500 flex justify-between border-t border-gray-800">
        <span>Encoding: UTF-8</span>
        <span>Lines: {result.content.split('\n').length}</span>
        <span>Size: {result.content.length} Bytes</span>
        <span>Mode: Production Read-Only</span>
      </div>
    </div>
  );
};
