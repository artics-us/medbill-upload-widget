import crypto from 'crypto';

const TOKEN_SECRET = process.env.BILL_TOKEN_SECRET || 'dev-secret-change-me';

type BillTokenPayload = {
  caseId: string;
  iat: number;
};

export function signBillToken(caseId: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');

  const payload: BillTokenPayload = {
    caseId,
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const data = `${header}.${payloadStr}`;
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');

  return `${data}.${signature}`;
}

export function verifyBillToken(token: string): BillTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');

  if (signature !== expected) {
    throw new Error('Invalid token signature');
  }

  const decoded = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as BillTokenPayload;

  return decoded;
}
