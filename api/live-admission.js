// api/live-admission.js — 실시간 경쟁률(진학사/유웨이) & 대교협 대학어디가 실시간 API 프록시
//
// 지원 액션:
// 1. ?action=ratio&url=<ratioUrl> : 진학사(addon.jinhakapply.com) / 유웨이(ratio.uwayapply.com) 실시간 경쟁률 파싱
// 2. ?action=smartratio           : 전국 대학 실시간 원서접수 일정 및 경쟁률 현황 리스트 조회
// 3. ?action=adiga&uni=<대학명>   : 대교협 대학어디가(adiga.kr) 실시간 대학코드/입학처/대입소식 조회

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cleanText(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchDecodedHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8'
      }
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    const contentType = res.headers.get('content-type') || '';
    if (
      html.includes('\ufffd') ||
      /euc-kr|ks_c_5601/i.test(contentType) ||
      /charset\s*=\s*["']?(?:euc-kr|ks_c_5601)/i.test(html.slice(0, 2000))
    ) {
      html = new TextDecoder('euc-kr').decode(buf);
    }
    return html;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function parseHtmlTables(html) {
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const summaryTables = [];
  const deptTables = [];

  // Caption or preceding h2/h3/div title extraction
  for (let tIdx = 0; tIdx < tableMatches.length; tIdx++) {
    const tbl = tableMatches[tIdx];
    const captionMatch = tbl.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    let title = captionMatch ? cleanText(captionMatch[1]) : '';

    const trMatches = tbl.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (trMatches.length < 2) continue;

    // Handle simple rowspan carry-over for first column (e.g. 계열/캠퍼스)
    const rows = [];
    let carryCol0 = '';
    let carryRemaining = 0;
    let expectedCols = 0;

    for (let rIdx = 0; rIdx < trMatches.length; rIdx++) {
      const tr = trMatches[rIdx];
      const cellMatches = tr.match(/<(?:th|td)[^>]*>[\s\S]*?<\/(?:th|td)>/gi) || [];
      if (!cellMatches.length) continue;

      const cells = [];
      let firstCellRowspan = 1;
      cellMatches.forEach((rawCell, cIdx) => {
        if (cIdx === 0) {
          const rs = rawCell.match(/rowspan\s*=\s*["']?(\d+)["']?/i);
          if (rs && Number(rs[1]) > 1) firstCellRowspan = Number(rs[1]);
        }
        cells.push(cleanText(rawCell));
      });

      if (rIdx === 0) {
        expectedCols = cells.length;
        rows.push(cells);
        continue;
      }

      if (carryRemaining > 0 && cells.length === expectedCols - 1) {
        cells.unshift(carryCol0);
        carryRemaining--;
      } else if (firstCellRowspan > 1 && cells.length === expectedCols) {
        carryCol0 = cells[0];
        carryRemaining = firstCellRowspan - 1;
      }

      if (cells.length >= 3 && cells.some(Boolean)) {
        rows.push(cells);
      }
    }

    if (rows.length < 2) continue;
    const headers = rows[0];
    const headerJoined = headers.join(' ');
    if (!/전형|모집|지원|경쟁률|구분|단위|학과|인원/.test(headerJoined)) continue;

    const dataRows = rows.slice(1).filter(r => {
      const joined = r.join(' ');
      return joined.length > 0 && !/검색 결과가 없습니다|데이터가 없습니다/.test(joined);
    });
    if (!dataRows.length) continue;

    const tableObj = {
      title: title || (headers.includes('모집단위') || headers.includes('학과') ? `모집단위별 현황 (${deptTables.length + 1})` : `전형별 총괄 현황 (${summaryTables.length + 1})`),
      headers,
      rows: dataRows.slice(0, 120)
    };

    if (headers.some(h => /모집단위|학과|전공|학부/.test(h)) && summaryTables.length >= 1) {
      deptTables.push(tableObj);
    } else if (summaryTables.length < 2 && !headers.some(h => /모집단위|학과/.test(h))) {
      summaryTables.push(tableObj);
    } else {
      deptTables.push(tableObj);
    }
  }

  return { summaryTables, deptTables: deptTables.slice(0, 15) };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only' });
  }

  const action = String(req.query.action || 'ratio');

  try {
    // 1. 실시간 경쟁률 테이블 파싱
    if (action === 'ratio') {
      const targetUrl = String(req.query.url || '').trim();
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ ok: false, error: '유효한 경쟁률 URL이 필요합니다.' });
      }
      // Allow only known ratio / university domains
      const html = await fetchDecodedHtml(targetUrl);
      const pageTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const pageTitle = pageTitleMatch ? cleanText(pageTitleMatch[1]) : '실시간 경쟁률 현황';
      const { summaryTables, deptTables } = parseHtmlTables(html);

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        url: targetUrl,
        pageTitle,
        summaryTables,
        deptTables
      });
    }

    // 2. 전국 대학 스마트경쟁률 메타 목록
    if (action === 'smartratio') {
      const html = await fetchDecodedHtml('https://apply.jinhakapply.com/SmartRatio');
      const decoded = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const m = decoded.match(/\[\["[^"]+?",\s*[24],\s*"(?:수시|정시)"[\s\S]*?\]\]/);
      const rawList = m ? JSON.parse(m[0]) : [];
      const list = rawList.map(item => ({
        name: item[0],
        schoolType: item[1] === 4 ? '4년제' : '전문대',
        Category: item[2],
        subType: item[3],
        region: item[4],
        estType: item[5],
        startDate: item[6],
        endDate: item[7],
        noticeUrl: (item[8] || '').trim(),
        ratioUrl: (item[10] || '').trim(),
        year: item[13],
        homeUrl: (item[15] || '').trim()
      }));

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        count: list.length,
        list
      });
    }

    // 3. 대교협 대학어디가(adiga.kr) 실시간 대학정보 & 대입뉴스 조회
    if (action === 'adiga') {
      const uni = String(req.query.uni || '').trim();
      if (!uni) {
        return res.status(400).json({ ok: false, error: 'uni 파라미터가 필요합니다.' });
      }
      const cleanName = uni.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      const params = new URLSearchParams({
        offset: '0',
        limit: '5',
        search: cleanName,
        sort: '',
        sortType: '',
        reSearch: '',
        exceptSearch: '',
        sortYear: '2027',
        accuracySearch: '',
        checkMiss: '1'
      });

      const [infoRes, newsRes] = await Promise.all([
        fetch(`https://www.adiga.kr/man/sch/univInfo.do?${params.toString()}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).then(r => r.json()).catch(() => null),
        fetch(`https://www.adiga.kr/man/sch/univAdmNews.do?${params.toString()}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).then(r => r.json()).catch(() => null)
      ]);

      const rows = (infoRes?.result?.rows || []).map(r => {
        const f = r.fields || {};
        return {
          univNm: cleanText(f.UNIV_NM),
          unvCd: f.UNIV_CD,
          area: f.AREA,
          fondSe: f.FOND_SE,
          bnhh: f.BNHH,
          tel: f.TEL_NO,
          adres: cleanText(f.ADRES),
          entUrl: f.ENTEXM_HMPG,
          hmpg: f.HMPG,
          adigaDetailUrl: f.PGE_URL ? `https://www.adiga.kr${f.PGE_URL}&menuId=PCUVTINF2000` : `https://www.adiga.kr/man/sch/searchView.do?menuId=PCMANSCH5001&checkMiss=1&search=${encodeURIComponent(cleanName)}`
        };
      });

      const news = (newsRes?.result?.rows || []).map(r => {
        const f = r.fields || {};
        return {
          title: cleanText(f.SJ),
          summary: cleanText(f.CN),
          date: (f.INS_DT || '').slice(0, 10),
          url: f.PGE_URL ? `https://www.adiga.kr${f.PGE_URL}` : 'https://www.adiga.kr'
        };
      });

      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
      return res.status(200).json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        uni: cleanName,
        universities: rows,
        news
      });
    }

    return res.status(400).json({ ok: false, error: '지원하지 않는 action입니다.' });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: err.message || '실시간 데이터 조회 중 오류가 발생했습니다.'
    });
  }
}
