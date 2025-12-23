'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { saveCaseProgress, initializeOutboxFlush } from '@/lib/base44-case-progress';

const BASE44_ORIGIN = process.env.NEXT_PUBLIC_BASE44_ORIGIN || '';

type UploadDoneMessage = {
  type: 'UPLOAD_DONE';
  caseId: string;
  caseToken: string;
};

type UploadErrorMessage = {
  type: 'UPLOAD_ERROR';
  error: string;
};

type FileUploadStatus = {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  caseId?: string;
  caseToken?: string;
};

// Decide the target origin for postMessage
function getTargetOrigin(): string {
  if (typeof window === 'undefined') return '*';

  // When opened directly (not inside an iframe), use own origin (local dev, etc.)
  if (window.parent === window) {
    return window.location.origin;
  }

  // When embedded in Base44 iframe and origin is configured
  if (BASE44_ORIGIN) {
    return BASE44_ORIGIN;
  }

  // Fallback (in production, you should prefer setting BASE44_ORIGIN explicitly)
  return '*';
}

function UploadWidgetContent({ caseId }: { caseId: string | null }) {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize outbox flush on mount
  useEffect(() => {
    initializeOutboxFlush();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.parent) return;

    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      const targetOrigin = getTargetOrigin();

      try {
        window.parent.postMessage(
          { type: 'WIDGET_HEIGHT', height },
          targetOrigin
        );
      } catch (e) {
        console.error('Failed to post WIDGET_HEIGHT message:', e);
      }
    };

    // 初回送信
    sendHeight();

    // コンテンツの高さ変化を監視
    const observer = new ResizeObserver(() => {
      sendHeight();
    });

    // body を監視（必要なら他の要素も追加）
    observer.observe(document.body);

    // ページロード完了時にも念のため送る
    window.addEventListener('load', sendHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('load', sendHeight);
    };
  }, []);
  // 🔼 ここまで追加

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const newFiles: FileUploadStatus[] = selectedFiles.map((file) => ({
        file,
        status: 'pending',
        progress: 0,
      }));
      // Append new files to existing ones instead of replacing
      setFiles((prev) => [...prev, ...newFiles]);
      setError(null);
      setSuccessMessage(null);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      const newFiles: FileUploadStatus[] = droppedFiles.map((file) => ({
        file,
        status: 'pending',
        progress: 0,
      }));
      // Append new files to existing ones instead of replacing
      setFiles((prev) => [...prev, ...newFiles]);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openFileDialog = () => {
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    input?.click();
  };

  const uploadSingleFile = async (
    fileStatus: FileUploadStatus,
    index: number,
    caseIdForUpload: string,
    isFromQueryParam: boolean,
  ): Promise<{ caseToken: string } | null> => {
    const { file } = fileStatus;

    // Update status to uploading
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: 'uploading', progress: 0 };
      return updated;
    });

    try {
      // 1. Request a signed upload URL from our backend
      const uploadUrlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          caseId: caseIdForUpload, // Use the shared caseId
          checkDirectory: isFromQueryParam, // Only check directory if caseId came from query param
        }),
      });

      if (!uploadUrlRes.ok) {
        const text = await uploadUrlRes.text();
        console.error('upload-url error response:', text);
        throw new Error('Failed to get upload URL: ' + text);
      }

      const { signedUrl, gcsPath, caseToken } = await uploadUrlRes.json();

      console.log('Got signed URL:', { signedUrl, gcsPath, caseId: caseIdForUpload });

      // Update progress
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], progress: 50 };
        return updated;
      });

      // 2. Upload the file directly to GCS using the signed URL
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!putRes.ok) {
        console.error('Upload PUT failed:', putRes.status, putRes.statusText);
        throw new Error(
          `Failed to upload file to storage (status ${putRes.status})`,
        );
      }

      // Update status to success
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'success',
          progress: 100,
          caseId: caseIdForUpload,
          caseToken,
        };
        return updated;
      });

      console.log('File uploaded successfully to GCS:', gcsPath);
      return { caseToken };
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e instanceof Error ? e.message : 'Something went wrong during upload.';

      // Update status to error
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: msg,
        };
        return updated;
      });

      // Error notification will be handled in runUpload
      throw e;
    }
  };

  const runUpload = useCallback(async () => {
    if (files.length === 0) {
      setError('Please select at least one file before continuing.');
      return;
    }

    // Filter out files that are already successfully uploaded
    const pendingFiles = files.filter((f) => f.status !== 'success');

    if (pendingFiles.length === 0) {
      setError('All files have already been uploaded.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    // Use case_id from query parameter if provided, otherwise reuse existing caseId or generate a new one
    const existingSuccessFile = files.find((f) => f.status === 'success' && f.caseId);
    // If caseId (from query param) exists, use it (will check directory existence in backend)
    // If existingSuccessFile has caseId, reuse it (directory already exists)
    // Otherwise, generate a new one (new directory will be created, no check needed)
    const resolvedCaseId =
      caseId ||
      existingSuccessFile?.caseId ||
      (typeof window !== 'undefined' && window.crypto
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`);
    // Only check directory existence if caseId came from query param
    // If it's from existing file or newly generated, directory will exist or will be created
    const isFromQueryParam = !!caseId;

    try {
      // Store the count of pending files before upload
      const pendingCount = pendingFiles.length;

      // Upload only pending files in parallel using the same caseId
      const uploadPromises = pendingFiles.map((fileStatus) => {
        const index = files.indexOf(fileStatus);
        return uploadSingleFile(fileStatus, index, resolvedCaseId, isFromQueryParam);
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Count previously uploaded files (before this run)
      const alreadyUploadedCount = files.filter((f) => f.status === 'success').length;
      const totalSuccessCount = alreadyUploadedCount + pendingCount;

      // Get caseToken from the latest batch (fallback handled below if null)
      const newCaseToken =
        uploadResults.find((result): result is { caseToken: string } => !!result)?.caseToken;

      if (pendingCount > 0 && (newCaseToken || alreadyUploadedCount > 0)) {
        setSuccessMessage(
          `${pendingCount} file${pendingCount > 1 ? 's' : ''} uploaded successfully.${
            alreadyUploadedCount > 0 ? ` (${totalSuccessCount} total)` : ''
          }`,
        );

        // Save upload status to /api/case-progress (with Outbox pattern for retry)
        try {
          await saveCaseProgress({
            caseId: resolvedCaseId,
            currentStep: 'upload',
            stepData: {
              hasUpload: true,
              uploadCount: totalSuccessCount,
              lastUploadAt: new Date().toISOString(),
              caseToken: newCaseToken ?? null,
            },
          });
        } catch (cpErr) {
          console.error('Failed to save upload step to /api/case-progress:', cpErr);
          // Error is already handled by saveCaseProgress (added to outbox if retryable)
          // UI remains successful since DB save is guaranteed via outbox retry
        }

        // Notify the parent (Base44) that upload is completed (only once for all files)
        if (newCaseToken && typeof window !== 'undefined' && window.parent) {
          const targetOrigin = getTargetOrigin();
          const msg: UploadDoneMessage = {
            type: 'UPLOAD_DONE',
            caseId: resolvedCaseId,
            caseToken: newCaseToken,
          };
          window.parent.postMessage(msg, targetOrigin);
        }
      }
    } catch (e: unknown) {
      console.error('Upload error:', e);
      const errorCount = files.filter((f) => f.status === 'error').length;
      if (errorCount > 0) {
        setError(
          `${errorCount} file${errorCount > 1 ? 's' : ''} failed to upload.`,
        );
      }

      // Notify parent about the error
      if (typeof window !== 'undefined' && window.parent) {
        const targetOrigin = getTargetOrigin();
        const errorMsg =
          e instanceof Error ? e.message : 'Something went wrong during upload.';
        const errMsg: UploadErrorMessage = {
          type: 'UPLOAD_ERROR',
          error: errorMsg,
        };
        window.parent.postMessage(errMsg, targetOrigin);
      }
    } finally {
      setIsUploading(false);
    }
  }, [files, caseId]);

  // Listen for START_ANALYSIS from Base44 and trigger upload when received
  useEffect(() => {
    function handler(event: MessageEvent) {
      const expected = BASE44_ORIGIN;
      // If BASE44_ORIGIN is set, only accept messages from that origin
      if (expected && event.origin !== expected) return;

      if (event.data?.type === 'START_ANALYSIS') {
        void runUpload();
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }
  }, [runUpload]); // When runUpload changes, update the event listener

  return (
    <div className="w-full min-h-full flex flex-col items-center justify-start bg-transparent px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        {/* hidden file input */}
        <input
          id="file-input"
          type="file"
          accept=".pdf,image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {files.length === 0 ? (
          // Initial state: show drag & drop area
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <p className="text-sm text-gray-700">
              Drag &amp; drop your bills here
            </p>
            <p className="text-xs text-gray-500">or</p>

            <button
              type="button"
              onClick={openFileDialog}
              disabled={isUploading}
              className={`px-4 py-2 rounded-full text-sm font-semibold text-white transition-all ${
                isUploading
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#0052CC] to-[#0A2540] hover:shadow-lg'
              }`}
            >
              Choose files
            </button>

            <p className="text-[11px] text-gray-400 mt-1">
              Supported: PDF, images · Max 5MB per file
            </p>
          </div>
        ) : (
          // Files selected: show file list and "Select another" button
          <>
            <div className="w-full space-y-2">
              <p className="text-xs text-gray-600 font-medium">
                Selected {files.length} file{files.length > 1 ? 's' : ''}:
              </p>
              {files.map((fileStatus, index) => (
                <div
                  key={`${fileStatus.file.name}-${index}`}
                  className="text-xs text-gray-700 p-2 bg-gray-50 rounded border"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium break-all flex-1">
                      {fileStatus.file.name}
                    </span>
                    <span className="ml-2 text-[10px]">
                      {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  {fileStatus.status === 'uploading' && (
                    <Progress value={fileStatus.progress} className="h-1" />
                  )}
                  {fileStatus.status === 'success' && (
                    <p className="text-[10px] text-green-600 mt-1">
                      ✓ Uploaded
                    </p>
                  )}
                  {fileStatus.status === 'error' && (
                    <p className="text-[10px] text-red-600 mt-1">
                      ✗ {fileStatus.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div
              className="border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 text-center"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <button
                type="button"
                onClick={openFileDialog}
                disabled={isUploading}
                className={`px-4 py-2 rounded-full text-sm font-semibold text-white transition-all ${
                  isUploading
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#0052CC] to-[#0A2540] hover:shadow-lg'
                }`}
              >
                Select another
              </button>

              <p className="text-[11px] text-gray-400">
                Supported: PDF, images · Max 5MB per file
              </p>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {successMessage && (
          <p className="text-sm text-green-600">{successMessage}</p>
        )}

        {/* アップロード実行ボタン */}
        <button
          type="button"
          onClick={runUpload}
          disabled={isUploading || files.length === 0}
          className={`w-full rounded-xl py-4 text-sm font-bold text-white transition-all flex items-center justify-center ${
            isUploading || files.length === 0
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#0052CC] to-[#0A2540] hover:shadow-lg'
          }`}
        >
          {isUploading
            ? `Uploading ${
                files.filter((f) => f.status === 'uploading').length
              } file${
                files.filter((f) => f.status === 'uploading').length !== 1
                  ? 's'
                  : ''
              }…`
            : `Upload ${files.length} bill${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

export default function UploadWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-full flex flex-col items-center justify-start bg-transparent px-4 py-6">
          <div className="w-full max-w-md space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center">
              <p className="text-sm text-gray-700">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <UploadWidgetWithParams />
    </Suspense>
  );
}

function UploadWidgetWithParams() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('case_id');

  return <UploadWidgetContent caseId={caseId} />;
}
