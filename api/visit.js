// api/visit.js  — 오늘/누적 방문자 수 (Upstash Redis REST API)
// 환경변수: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // 미설정 상태에서는 더미값 반환 (배포 전에 화면에 깨지지 않게)
    return res.status(200).json({ today: '—', total: '—' });
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // 예: 20260905
  const keyToday = `visits:${today}`;
  const keyTotal = 'visits:total';

  // Redis REST API로 INCR (동시성-safe 카운터)
  const redisFetch = async (key) => {
    const r = await fetch(`${url}/incr/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Redis INCR ${key} failed: ${r.status} ${text}`);
    }
    const j = await r.json();
    return j.result;
  };

  let todayCount, totalCount;
  try {
    todayCount = await redisFetch(keyToday);
    totalCount = await redisFetch(keyTotal);
  } catch (err) {
    console.error('visit counter error:', err.message);
    return res.status(500).json({ error: 'counter error' });
  }

  return res.status(200).json({ today: todayCount, total: totalCount });
}
