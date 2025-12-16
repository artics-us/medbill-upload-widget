/**
 * Base44 Case Progress Client Utility
 *
 * This utility provides a client-side interface for saving case progress to the API
 * with idempotency guarantees and automatic retry via Outbox pattern.
 *
 * Features:
 * - Automatic submissionId generation
 * - Outbox pattern for retry on failure
 * - localStorage-based persistence
 * - Automatic flush on page load and after failures
 *
 * IMPORTANT: This is a CLIENT-SIDE utility. You MUST call `initializeOutboxFlush()`
 * in your frontend application (e.g., in a React useEffect or app initialization)
 * for the outbox retry mechanism to work.
 *
 * Usage in Base44 frontend:
 * ```typescript
 * import { saveCaseProgress, initializeOutboxFlush } from '@/lib/base44-case-progress';
 *
 * // 1. Initialize outbox flush ONCE when your app starts (e.g., in useEffect or app.tsx)
 * useEffect(() => {
 *   initializeOutboxFlush();
 * }, []);
 *
 * // 2. Use saveCaseProgress to save progress
 * await saveCaseProgress({
 *   caseId: 'uuid-here',
 *   currentStep: 'hospital',
 *   stepData: { hospitalName: '...' }
 * });
 * ```
 *
 * Note: If you don't call `initializeOutboxFlush()`, failed requests will still be
 * stored in localStorage, but they won't be automatically retried on page load or
 * when coming back online. You can manually call `flushOutbox()` if needed.
 */

const OUTBOX_STORAGE_KEY = 'base44_case_progress_outbox';
const CASE_ID_STORAGE_KEY = 'base44_case_id';

export interface CaseProgressPayload {
  submissionId?: string; // Optional: will be generated if not provided
  caseId: string;
  currentStep: string;
  stepData: Record<string, unknown>;
}

export interface CaseProgressResponse {
  success: boolean;
  caseId: string;
  currentStep: string;
  submissionId: string;
  warning?: string;
  error?: string;
  retryable?: boolean;
}

export interface OutboxItem {
  submissionId: string;
  payload: CaseProgressPayload;
  timestamp: number;
  retryCount: number;
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the API endpoint URL
 */
function getApiUrl(): string {
  if (typeof window === 'undefined') {
    return '/api/case-progress';
  }
  // Use relative URL for same-origin requests
  return '/api/case-progress';
}

/**
 * Load outbox from localStorage
 */
function loadOutbox(): OutboxItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as OutboxItem[];
    // Filter out items older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return parsed.filter((item) => item.timestamp > sevenDaysAgo);
  } catch (e) {
    console.error('Failed to load outbox from localStorage:', e);
    return [];
  }
}

/**
 * Save outbox to localStorage
 */
function saveOutbox(outbox: OutboxItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(outbox));
  } catch (e) {
    console.error('Failed to save outbox to localStorage:', e);
  }
}

/**
 * Add item to outbox
 */
function addToOutbox(payload: CaseProgressPayload): void {
  const outbox = loadOutbox();
  const submissionId = payload.submissionId || generateUUID();

  const item: OutboxItem = {
    submissionId,
    payload: {
      ...payload,
      submissionId, // Ensure submissionId is set
    },
    timestamp: Date.now(),
    retryCount: 0,
  };

  outbox.push(item);
  saveOutbox(outbox);
}

/**
 * Remove item from outbox by submissionId
 */
function removeFromOutbox(submissionId: string): void {
  const outbox = loadOutbox();
  const filtered = outbox.filter((item) => item.submissionId !== submissionId);
  saveOutbox(filtered);
}

/**
 * Save caseId to both sessionStorage and localStorage for recovery
 */
export function saveCaseId(caseId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CASE_ID_STORAGE_KEY, caseId);
    localStorage.setItem(CASE_ID_STORAGE_KEY, caseId);
  } catch (e) {
    console.error('Failed to save caseId:', e);
  }
}

/**
 * Get caseId from storage (prefer sessionStorage, fallback to localStorage)
 */
export function getCaseId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(CASE_ID_STORAGE_KEY) ||
           localStorage.getItem(CASE_ID_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to get caseId:', e);
    return null;
  }
}

/**
 * Save case progress to API
 *
 * @param payload - Case progress payload
 * @returns Promise resolving to API response
 */
export async function saveCaseProgress(
  payload: CaseProgressPayload,
): Promise<CaseProgressResponse> {
  // Generate submissionId if not provided
  const submissionId = payload.submissionId || generateUUID();
  const payloadWithId = { ...payload, submissionId };

  // Save caseId to storage for recovery
  if (payload.caseId) {
    saveCaseId(payload.caseId);
  }

  try {
    const response = await fetch(getApiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadWithId),
    });

    const data = (await response.json()) as CaseProgressResponse;

    if (!response.ok || !data.success) {
      // API returned error - check if retryable
      const isRetryable = data.retryable !== false &&
                         (response.status === 503 || response.status >= 500);

      if (isRetryable) {
        // Add to outbox for retry
        addToOutbox(payloadWithId);
        console.warn(
          `Case progress save failed (retryable), added to outbox:`,
          data.error || 'Unknown error',
        );
      }

      throw new Error(data.error || `API error: ${response.status}`);
    }

    // Success - remove from outbox if it was there
    removeFromOutbox(submissionId);

    return data;
  } catch (error: unknown) {
    // Network error or other failure - add to outbox
    const isNetworkError = error instanceof TypeError ||
                          (error instanceof Error && error.message.includes('fetch'));

    if (isNetworkError) {
      addToOutbox(payloadWithId);
      console.warn(
        'Case progress save failed (network error), added to outbox:',
        error,
      );
    }

    // Re-throw for caller to handle
    throw error;
  }
}

/**
 * Flush outbox - retry all pending items
 *
 * @param maxRetries - Maximum number of retries per item (default: 5)
 * @returns Promise resolving to flush results
 */
export async function flushOutbox(maxRetries: number = 5): Promise<{
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const outbox = loadOutbox();
  if (outbox.length === 0) {
    return { succeeded: 0, failed: 0, skipped: 0 };
  }

  const results = { succeeded: 0, failed: 0, skipped: 0 };
  const updatedOutbox: OutboxItem[] = [];

  for (const item of outbox) {
    // Skip items that have exceeded max retries
    if (item.retryCount >= maxRetries) {
      results.skipped++;
      // Remove old items that exceeded retries
      continue;
    }

    try {
      const response = await fetch(getApiUrl(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.payload),
      });

      const data = (await response.json()) as CaseProgressResponse;

      if (response.ok && data.success) {
        // Success - remove from outbox
        results.succeeded++;
        console.log(
          `Outbox item ${item.submissionId} sent successfully`,
        );
      } else {
        // Still failed - increment retry count
        const updatedItem: OutboxItem = {
          ...item,
          retryCount: item.retryCount + 1,
        };
        updatedOutbox.push(updatedItem);
        results.failed++;
        console.warn(
          `Outbox item ${item.submissionId} failed (retry ${updatedItem.retryCount}/${maxRetries})`,
        );
      }
    } catch (error) {
      // Network error - increment retry count
      const updatedItem: OutboxItem = {
        ...item,
        retryCount: item.retryCount + 1,
      };
      updatedOutbox.push(updatedItem);
      results.failed++;
      console.warn(
        `Outbox item ${item.submissionId} network error (retry ${updatedItem.retryCount}/${maxRetries})`,
        error,
      );
    }
  }

  // Save updated outbox
  saveOutbox(updatedOutbox);

  return results;
}

/**
 * Initialize outbox flushing on page load
 *
 * IMPORTANT: This MUST be called in your FRONTEND application (client-side) for
 * the outbox retry mechanism to work. This is NOT a server-side function.
 *
 * Call this once when your app initializes (e.g., in React useEffect, app.tsx, etc.)
 *
 * What it does:
 * - Flushes outbox immediately on page load
 * - Sets up listener to flush when network comes back online
 * - Sets up periodic flush (every 30 seconds) for resilience
 *
 * Example in React:
 * ```typescript
 * useEffect(() => {
 *   initializeOutboxFlush();
 * }, []);
 * ```
 *
 * Example in vanilla JS:
 * ```javascript
 * // In your app initialization code
 * initializeOutboxFlush();
 * ```
 */
export function initializeOutboxFlush(): void {
  if (typeof window === 'undefined') {
    console.warn(
      'initializeOutboxFlush() called in server-side context. ' +
      'This function must be called in the browser (client-side).',
    );
    return;
  }

  // Flush immediately on load
  void flushOutbox();

  // Also flush when online (if was offline)
  window.addEventListener('online', () => {
    console.log('Network online - flushing outbox');
    void flushOutbox();
  });

  // Optional: Periodic flush (every 30 seconds) for resilience
  setInterval(() => {
    const outbox = loadOutbox();
    if (outbox.length > 0) {
      console.log(`Periodic outbox flush: ${outbox.length} items pending`);
      void flushOutbox();
    }
  }, 30000);
}

/**
 * Clear outbox (useful for testing or manual cleanup)
 */
export function clearOutbox(): void {
  saveOutbox([]);
}

/**
 * Get outbox status (useful for debugging)
 */
export function getOutboxStatus(): {
  count: number;
  items: OutboxItem[];
} {
  const outbox = loadOutbox();
  return {
    count: outbox.length,
    items: outbox,
  };
}
