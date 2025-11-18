'use client';

import { useEffect, useState } from 'react';

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

export default function UploadWidgetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError(null);
    setSuccessMessage(null);
  };

  const runUpload = async () => {
    if (!file) {
      setError('Please select a file before continuing.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Request a signed upload URL from our backend
      const uploadUrlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });

      if (!uploadUrlRes.ok) {
        const text = await uploadUrlRes.text();
        console.error('upload-url error response:', text);
        throw new Error('Failed to get upload URL: ' + text);
      }

      const { signedUrl, gcsPath, billId, billToken } =
        await uploadUrlRes.json();

      console.log('Got signed URL:', { signedUrl, gcsPath, billId });

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

      setSuccessMessage('File uploaded successfully.');
      console.log('File uploaded successfully to GCS:', gcsPath);

      // 3. Notify the parent (Base44) that upload is completed
      if (typeof window !== 'undefined' && window.parent) {
        const targetOrigin = getTargetOrigin();
        const msg: UploadDoneMessage = { type: 'UPLOAD_DONE', billId, billToken };
        window.parent.postMessage(msg, targetOrigin);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || 'Something went wrong during upload.';
      setError(msg);

      // Notify parent about the error as well
      if (typeof window !== 'undefined' && window.parent) {
        const targetOrigin = getTargetOrigin();
        const errMsg: UploadErrorMessage = { type: 'UPLOAD_ERROR', error: msg };
        window.parent.postMessage(errMsg, targetOrigin);
      }
    } finally {
      setIsUploading(false);
    }
  };

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
  }, [file]); // When file changes, runUpload will use the latest selected file

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-start p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">
          Upload your hospital bill
        </h1>
        <p className="text-sm text-gray-600">
          Select your hospital bill PDF or image. We&apos;ll securely upload it
          so our team can review it later.
        </p>

        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3">
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileChange}
          />
          {file && (
            <div className="text-sm text-gray-700">
              Selected:{' '}
              <span className="font-medium break-all">{file.name}</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {successMessage && (
          <p className="text-sm text-green-600">{successMessage}</p>
        )}

        <button
          type="button"
          onClick={runUpload}
          disabled={isUploading || !file}
          className={`w-full rounded-full py-3 text-sm font-semibold ${
            isUploading || !file
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isUploading ? 'Uploading…' : 'Upload bill'}
        </button>
      </div>
    </div>
  );
}
