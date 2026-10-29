// api/visit.js — 오늘/누적 방문자 수 (Upstash Redis REST API)
//
// 환경변수: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
//   Vercel 마켓플레이스에서 Upstash Redis 를 프로젝트에 연결하면 KV_REST_API_URL / KV_REST_API_TOKEN
//   이름으로 들어온다. 두 이름을 모두 받는다.
//
// 세는 방식: 브라우저(쿠키) 하나당 하루 한 번. 새로고침이나 메뉴 이동으로는 늘지 않는다.
//   날짜는 한국 시간(KST) 기준이라 자정에 바뀐다. 누적은 '하루에 한 번씩 온 방문'의 합이다.
//   쿠키에는 날짜만 들어 있고 개인을 식별하는 값은 없다.

const COOKIE = 'sr_visit';
// 같은 Redis 를 다른 프로젝트와 나눠 써도 키가 섞이지 않게 이 앱 전용 접두어를 붙인다.
const PREFIX = 'neis-help:visits';
const KEEP_DAYS = 400; // 날짜별 키는 이 기간이 지나면 저절로 지워진다

function kstDate(now = new Date()) {
  // UTC 에 9시간을 더해 한국 날짜를 얻는다. 예: 20260905
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

function readCookie(header, name) {
  const m = String(header || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? m.slice(name.length + 1) : '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

  if (!url || !token) {
    // 저장소가 아직 연결되지 않은 상태 — 화면은 이 값을 보면 카운터를 숨긴다
    return res.status(200).json({ today: '—', total: '—' });
  }

  const today = kstDate();
  const keyToday = `${PREFIX}:${today}`;
  const keyTotal = `${PREFIX}:total`;
  const counted = readCookie(req.headers.cookie, COOKIE) === today;

  // 한 번의 요청으로 처리한다(pipeline). 오늘 이미 센 브라우저는 읽기만 한다.
  const commands = counted
    ? [['GET', keyToday], ['GET', keyTotal]]
    : [['INCR', keyToday], ['INCR', keyTotal], ['EXPIRE', keyToday, String(KEEP_DAYS * 86400)]];

  let results;
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!r.ok) throw new Error(`Redis pipeline failed: ${r.status} ${await r.text()}`);
    results = await r.json();
    const bad = results.find((x) => x && x.error);
    if (bad) throw new Error(`Redis command error: ${bad.error}`);
  } catch (err) {
    console.error('visit counter error:', err.message);
    return res.status(500).json({ error: 'counter error' });
  }

  if (!counted) {
    res.setHeader('Set-Cookie', `${COOKIE}=${today}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`);
  }

  return res.status(200).json({
    today: Number(results[0].result) || 0,
    total: Number(results[1].result) || 0,
  });
}
