import React, { useRef, useState } from 'react';
import { FileText, Trash2, Upload, Loader2, X } from 'lucide-react';
import { Doc } from '../lib/storage';
import { isSupportedDocFile } from '../lib/parse';
import { useToast } from './Toasts';

interface Props {
  documents: Doc[];
  selectedDocIds: string[];
  onToggleDoc: (docId: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteDoc: (docId: string) => Promise<void>;
  uploadProgress: string | null;
}

export const DocumentsTab: React.FC<Props> = ({
  documents,
  selectedDocIds,
  onToggleDoc,
  onUploadFile,
  onDeleteDoc,
  uploadProgress,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isSupportedDocFile(file)) {
        toast('Only PDF, Word (.docx) and text files are supported.', 'error');
        continue;
      }
      try {
        await onUploadFile(file);
      } catch (err: any) {
        toast(err?.message || 'Failed to process document', 'error');
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    await handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[var(--line)] shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm text-[var(--ink)]">Documents</h2>
          <p className="text-[var(--muted)] text-[11px] mt-0.5">
            Documents selected here are referenced in this chat.
          </p>
        </div>
      </div>

      {/* Uploading progress banner */}
      {uploadProgress && (
        <div className="mx-4 mt-3 p-2.5 bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-lg flex items-center gap-2 text-[var(--accent)] font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {documents.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)] space-y-2">
            <FileText className="w-8 h-8 mx-auto stroke-1 opacity-50" />
            <p className="leading-relaxed">
              No documents yet. Upload a PDF, Word or text file to ask questions about it.
            </p>
          </div>
        ) : (
          documents.map((d) => {
            const isChecked = selectedDocIds.includes(d.id);
            const isConfirming = confirmDeleteId === d.id;

            return (
              <div
                key={d.id}
                className={`p-3 rounded-lg border transition ${
                  isChecked
                    ? 'border-[var(--accent)] bg-[var(--surface)]'
                    : 'border-[var(--line)] bg-[var(--surface)] opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--ink)] truncate text-xs" title={d.name}>
                        {d.name}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] mt-0.5">
                        {d.pages} {d.pages === 1 ? 'page' : 'pages'} · {formatFileSize(d.size)}
                      </div>
                    </div>
                  </div>

                  {!isConfirming ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(d.id)}
                      className="p-1 rounded text-[var(--muted)] hover:text-[var(--danger)] cursor-pointer transition shrink-0"
                      aria-label="Delete document"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteDoc(d.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-[var(--danger)] text-white rounded text-[10px] font-medium hover:opacity-90 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[var(--muted)] hover:underline text-[10px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-[var(--line)]/60 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleDoc(d.id)}
                      className="rounded border-[var(--line)] accent-[var(--accent)]"
                    />
                    <span>Use in this chat</span>
                  </label>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload Drop Zone at Bottom */}
      <div className="p-4 border-t border-[var(--line)] shrink-0 bg-[var(--canvas)]">
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.docx,.txt,.md,.csv,.json"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
            isDragOver
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--line)] hover:border-[var(--muted)] bg-[var(--surface)]'
          }`}
        >
          <Upload className="w-4 h-4 text-[var(--muted)]" />
          <div className="font-medium text-[var(--ink)]">
            Drop PDF, Word or text files, or browse files.
          </div>
          <div className="text-[11px] text-[var(--muted)]">Max 20 MB each.</div>
        </div>
      </div>
    </div>
  );
};
