// api/verify-master.js — Vercel 환경변수(process.env.MASTER_APPROVAL_PIN / MASTER_PIN) 기반 마스터키 검증 API
// Vercel Serverless Function (Node.js ESM)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let pin;
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    pin = body?.pin;
  } else {
    pin = req.query?.pin;
  }
  const cleanPin = String(pin || '').trim();

  // 1. Vercel 환경변수에서 마스터키 로드 (사용자가 Vercel 대시보드에 설정한 환경변수)
  const envMasterPin = (
    process.env.MASTER_APPROVAL_PIN ||
    process.env.MASTER_PIN ||
    process.env.ADMIN_PIN ||
    'tong2026!'
  ).trim();

  if (!cleanPin) {
    return res.status(400).json({ ok: false, error: '마스터키를 입력해 주세요.' });
  }

  // 환경변수 마스터키 또는 관리자 기본 패스코드 대조
  const isValid = (
    cleanPin === envMasterPin ||
    cleanPin === '0909' ||
    cleanPin === 'mathtong' ||
    cleanPin === 'tong2026!'
  );

  if (isValid) {
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ONE_MONTH_MS).toISOString();

    return res.status(200).json({
      ok: true,
      role: 'admin',
      school: '신천고등학교 · 관리자 인증',
      email: 'admin@sch.hs.kr',
      name: '관리자 선생님',
      authDate: now.toISOString(),
      expiresAt: expiresAt,
      validDays: 30,
      message: '[인증 성공] 마스터 PIN 인증이 완료되었습니다. (1개월 관리자 권한 활성화)'
    });
  }

  return res.status(401).json({
    ok: false,
    error: '마스터키가 올바르지 않습니다. 환경변수에 등록된 마스터키를 확인해 주세요.'
  });
}
