// src/lib/gcs.ts
import { Storage } from '@google-cloud/storage';

/**
 * GCP_SERVICE_ACCOUNT_KEY にサービスアカウントJSONを
 * 1行の文字列として入れておく前提。
 *
 * 例 (.env.local):
 * GCP_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...@....iam.gserviceaccount.com",...}
 */

const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;

if (!keyJson) {
  throw new Error(
    'GCP_SERVICE_ACCOUNT_KEY is not set. Please add it to your .env.local',
  );
}

let parsedKey: {
  project_id: string;
  client_email: string;
  private_key: string;
};

try {
  parsedKey = JSON.parse(keyJson);
} catch (e) {
  console.error('Failed to parse GCP_SERVICE_ACCOUNT_KEY:', e);
  throw new Error(
    'GCP_SERVICE_ACCOUNT_KEY is not valid JSON. Check your .env.local formatting.',
  );
}

export const storage = new Storage({
  projectId: parsedKey.project_id,
  credentials: {
    client_email: parsedKey.client_email,
    private_key: parsedKey.private_key,
  },
});
