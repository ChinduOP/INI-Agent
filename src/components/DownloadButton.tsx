import React, { useState } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';

interface DownloadButtonProps {
  filename: string;
  content: string;
  className?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  filename,
  content,
  className = ''
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;

      // Call backend stream download endpoint
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: finalFilename, content })
      });

      if (!response.ok) {
        throw new Error('Download request failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error('Download error:', err);
      const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
      // Fallback direct blob download if fetch fails
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-50 ${className}`}
      title="Stream and download INI file directly to your local computer"
    >
      {downloading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Streaming...</span>
        </>
      ) : downloaded ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-200" />
          <span>Downloaded</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          <span>Download INI</span>
        </>
      )}
    </button>
  );
};
