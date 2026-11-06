// api/auth-config.js — Vercel 환경변수(GOOGLE_CLIENT_ID)를 프론트엔드에 안전하게 제공하는 API
// Vercel Serverless Function (Node.js ESM)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();

  const adminGasUrl = (
    process.env.ADMIN_GAS_URL ||
    process.env.GAS_ADMIN_URL ||
    process.env.ADMIN_GAS_APPROVAL_URL ||
    ''
  ).trim();

  return res.status(200).json({
    clientId: clientId,
    hasClientId: !!clientId,
    adminGasUrl: adminGasUrl,
    defaultSchoolDomain: 'sch.hs.kr'
  });
}
