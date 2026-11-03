import React, { useState } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface DownloadButtonProps {
  filename: string;
  content: string | null;
  isZip?: boolean;
  className?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  filename,
  content,
  isZip = false,
  className = ''
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const isSqlFile = /\.sql$/i.test(filename);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      if (isZip) {
        // Assume content is a JSON string of files for ZIP if isZip is true
        const files = JSON.parse(content || '[]');
        const zip = new JSZip();
        files.forEach((f: any) => {
          let folderPath = f.downloadPath || 'Unknown partner/Profiles/Documents';
          if (!folderPath.endsWith('/')) folderPath += '/';
          const cleanFilename = f.filename.replace(/^.*[\\\/]/, '');
          zip.file(`${folderPath}${cleanFilename}`, f.content);
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, filename.endsWith('.zip') ? filename : `${filename}.zip`);
      } else {
        const finalFilename = filename;
        const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, finalFilename);
      }

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 !text-white text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer ${className}`}
      title={isZip ? "Download ZIP archive of all configurations" : isSqlFile ? "Download SQL file" : "Download INI file"}
    >
      {downloading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin !text-white text-white" />
          <span className="!text-white text-white">Streaming...</span>
        </>
      ) : downloaded ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-200" />
          <span className="text-emerald-100">Downloaded</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 !text-white text-white" />
          <span className="!text-white text-white font-medium">{isZip ? 'Download ZIP' : isSqlFile ? 'Download SQL' : 'Download INI'}</span>
        </>
      )}
    </button>
  );
};
