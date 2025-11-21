'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

const BASE44_ORIGIN = process.env.NEXT_PUBLIC_BASE44_ORIGIN || '';

type UploadDoneMessage = {
  type: 'UPLOAD_DONE';
  billId: string;
  billToken: string;
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
  billId?: string;
  billToken?: string;
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
    billId: string,
    isFromQueryParam: boolean,
  ): Promise<void> => {
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
          billId, // Use the shared billId
          checkDirectory: isFromQueryParam, // Only check directory if billId came from query param
        }),
      });

      if (!uploadUrlRes.ok) {
        const text = await uploadUrlRes.text();
        console.error('upload-url error response:', text);
        throw new Error('Failed to get upload URL: ' + text);
      }

      const { signedUrl, gcsPath, billToken } = await uploadUrlRes.json();

      console.log('Got signed URL:', { signedUrl, gcsPath, billId });

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
          billId,
          billToken,
        };
        return updated;
      });

      console.log('File uploaded successfully to GCS:', gcsPath);
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

    // Use case_id from query parameter if provided, otherwise reuse existing billId or generate a new one
    const existingSuccessFile = files.find((f) => f.status === 'success' && f.billId);
    // If caseId (from query param) exists, use it (will check directory existence in backend)
    // If existingSuccessFile has billId, reuse it (directory already exists)
    // Otherwise, generate a new one (new directory will be created, no check needed)
    const billId = caseId || existingSuccessFile?.billId || (
      typeof window !== 'undefined' && window.crypto
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    );
    // Only check directory existence if billId came from query param (caseId)
    // If it's from existing file or newly generated, directory will exist or will be created
    const isFromQueryParam = !!caseId;

    try {
      // Store the count of pending files before upload
      const pendingCount = pendingFiles.length;

      // Upload only pending files in parallel using the same billId
      const uploadPromises = pendingFiles.map((fileStatus) => {
        const index = files.indexOf(fileStatus);
        return uploadSingleFile(fileStatus, index, billId, isFromQueryParam);
      });

      await Promise.all(uploadPromises);

      // Count successfully uploaded files (including newly uploaded ones)
      const totalSuccessCount = files.filter((f) => f.status === 'success').length;

      // Get billToken from any successfully uploaded file
      const firstSuccessFile = files.find((f) => f.status === 'success' && f.billToken);

      if (pendingCount > 0 && firstSuccessFile?.billToken) {
        const alreadyUploadedCount = totalSuccessCount - pendingCount;
        setSuccessMessage(
          `${pendingCount} file${pendingCount > 1 ? 's' : ''} uploaded successfully.${alreadyUploadedCount > 0 ? ` (${totalSuccessCount} total)` : ''}`,
        );

        // Notify the parent (Base44) that upload is completed (only once for all files)
        if (typeof window !== 'undefined' && window.parent) {
          const targetOrigin = getTargetOrigin();
          const msg: UploadDoneMessage = {
            type: 'UPLOAD_DONE',
            billId,
            billToken: firstSuccessFile.billToken,
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
            <p className="text-xs text-gray-500">
              or
            </p>

            <button
              type="button"
              onClick={openFileDialog}
              disabled={isUploading}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-300 disabled:text-gray-600"
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
                    <p className="text-[10px] text-green-600 mt-1">✓ Uploaded</p>
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
                className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-300 disabled:text-gray-600"
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
          className={`w-full rounded-full py-3 text-sm font-semibold ${
            isUploading || files.length === 0
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {isUploading
            ? `Uploading ${files.filter((f) => f.status === 'uploading').length} file${files.filter((f) => f.status === 'uploading').length !== 1 ? 's' : ''}…`
            : `Upload ${files.length} bill${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

export default function UploadWidgetPage() {
  return (
    <Suspense fallback={<div className="w-full min-h-full flex flex-col items-center justify-start bg-transparent px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center">
          <p className="text-sm text-gray-700">Loading...</p>
        </div>
      </div>
    </div>}>
      <UploadWidgetWithParams />
    </Suspense>
  );
}

function UploadWidgetWithParams() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('bill_id');

  return <UploadWidgetContent caseId={caseId} />;
}
