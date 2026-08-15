import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

interface UploadProps {
  compact?: boolean;
  onSuccess?: () => void;
}

export const Upload: React.FC<UploadProps> = ({ compact = false, onSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeSessionId = useChatStore(s => s.activeSessionId);
  const setUploadedExcel = useChatStore(s => s.setUploadedExcel);
  const isUploading = useChatStore(s => s.isUploading && s.activeSessionId === s.uploadingSessionId);
  const setUploading = useChatStore(s => s.setUploading);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setSuccessMsg(null);

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload a valid Excel document (.xlsx or .xls)');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload Excel workbook');
      }

      if (activeSessionId) {
        setUploadedExcel(activeSessionId, data.file);
      }
      setSuccessMsg(`Uploaded ${file.name} (${data.summary?.modulesCount || 0} Modules)`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  }, [activeSessionId, setUploadedExcel, setUploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  } as any);

  const handleLoadSample = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setSuccessMsg(null);
    try {
      setUploading(true);
      const res = await fetch('/api/sample-excel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (activeSessionId) {
        setUploadedExcel(activeSessionId, data.file);
      }
      setSuccessMsg('Sample Trading Partners Excel loaded!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div
          {...getRootProps()}
          className={`flex-1 border border-dashed rounded-lg px-3 py-2 cursor-pointer transition-all flex items-center justify-center gap-2 text-xs ${
            isDragActive ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          )}
          <span className="truncate">
            {isDragActive ? 'Drop Excel here...' : 'Upload Excel (.xlsx)'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          disabled={isUploading}
          className="px-2.5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors border border-gray-600 shrink-0 flex items-center gap-1.5 shadow-sm"
          title="Instantly generate and attach a sample 3-worksheet Excel workbook for immediate test runs"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sample Excel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full my-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragActive 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-700 bg-[#212121] hover:border-gray-500 hover:bg-[#272727]'
        }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-6 h-6" />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-200">
              {isDragActive ? 'Drop the Excel workbook here' : 'Click to upload or drag & drop Excel workbook'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Must contain <span className="font-semibold text-gray-300">Modules</span>, <span className="font-semibold text-gray-300">EDI</span>, and <span className="font-semibold text-gray-300">Document</span> worksheets
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono bg-black/30 px-2.5 py-1 rounded">Supported: .xlsx, .xls</span>
            <span className="text-xs text-gray-500">or</span>
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={isUploading}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium inline-flex items-center gap-1"
            >
              Load Sample Workbook
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5 bg-red-950/30 p-2.5 rounded-lg border border-red-900/50">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/50">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
