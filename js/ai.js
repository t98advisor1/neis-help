'use strict';
/* Gemini 무료 API 호출 (사용자 결정 2026-10-20). 브라우저에서 구글로 바로 보낸다 — 중간 서버 없음.
 * 키는 주소(URL)가 아니라 요청 헤더로 보낸다(주소는 기록에 남기 쉬움).
 * 주소 끝에 ?mock=1 을 붙이면 AI를 부르지 않고 가짜 문단을 돌려준다(화면 시험용, 무료 한도를 쓰지 않음).
 * node 에서도 require 해서 쓴다(tools/compare-models.mjs 가 같은 요청 본문·응답 해석을 쓰도록). */
(function (root) {
  // gemini-3.5-flash 는 2026-05 지원 종료 공지 뒤 gemini-3.6-flash 로 자동 연결된다(Gemini API 지원 종료 문서, 2026-10-21 확인).
  // 실제 응답 모델(modelVersion)도 3.6-flash 였으므로 같은 모델을 이름 그대로 부른다 — 결과·무료 한도는 전과 같음
  // 2026-10-21 확인: 3.6-flash 는 안정(Stable) 모델이고 종료 예정일 공지 없음. 최신은 3.8-flash(바꿀지는 실제 비교 뒤 사용자 결정)
  const DEFAULT_MODEL = 'gemini-3.6-flash';
  const TIMEOUT_MS = 90000;
  const isMock = () => typeof location !== 'undefined' && /[?&]mock=1\b/.test(location.search);

  class AIError extends Error {
    constructor(kind, message, detail) { super(message); this.kind = kind; this.detail = detail || ''; }
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /* 요청 본문 (학생 결과물 파일 첨부는 2026-10-21 사용자 결정으로 삭제 — 글만 보냄)
   * generationConfig:
   *  - maxOutputTokens 는 생각(thinking) 토큰까지 합친 한도다. 문단은 1,000토큰 안팎이고, 예전 시험에서 생각 포함 한 번에
   *    많게는 약 5,000토큰을 썼다 → 8192 로 둔다. 넘으면 finishReason 이 MAX_TOKENS 로 오고 parseResponse 가 막는다
   *  - temperature 는 넣지 않는다(기본 1.0). Gemini 3 문서가 1.0 미만으로 낮추면 반복·품질 저하가 생길 수 있다며 기본값을 권함
   *  - 생각 수준(thinkingLevel)은 모델 기본값(3.6-flash 는 medium). low 로 바꾸면 빨라지지만 실제 비교 전이라 그대로 둔다 */
  function buildBody(prompt, turns) {
    const first = [{ text: prompt.user }];
    return {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: first },
        ...(turns || []).map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] }))],
      generationConfig: { maxOutputTokens: 8192 },
    };
  }

  /* 성공(200) 응답에서 글만 꺼낸다. 끝까지 쓰지 못한 답(finishReason 이 STOP 이 아님)은 문단이 중간에 잘렸을 수 있어
   * 글이 있어도 쓰지 않는다 — 전에는 MAX_TOKENS 로 잘린 문단도 그대로 화면에 나와 복사될 수 있었음 */
  const DONE = new Set(['STOP', 'FINISH_REASON_UNSPECIFIED', undefined, null, '']);
  function parseResponse(j) {
    const cand = j && j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
    const reason = cand ? cand.finishReason : (j && j.promptFeedback && j.promptFeedback.blockReason) || 'NO_CANDIDATE';
    if (!DONE.has(reason) || !text) {
      if (reason === 'MAX_TOKENS') throw new AIError('cut', 'AI가 생각이 길어져 문단을 끝까지 쓰지 못했어요. 한 번 더 눌러 주세요.', reason);
      if (/SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(String(reason))) throw new AIError('blocked', 'AI가 안전 기준에 걸렸다며 답을 멈췄어요. 메모 표현을 조금 바꿔 다시 시도해 주세요.', reason);
      if (reason === 'RECITATION') throw new AIError('blocked', 'AI 답이 공개된 글과 너무 비슷하다며 멈췄어요. 한 번 더 눌러 주세요.', reason);
      throw new AIError('empty', text ? 'AI가 답을 끝까지 보내지 못했어요. 한 번 더 눌러 주세요.' : 'AI가 빈 답을 보냈어요. 메모를 조금 바꿔 다시 시도해 주세요.', String(reason || ''));
    }
    const u = (j && j.usageMetadata) || {};
    return { text, servedBy: j.modelVersion, finishReason: reason, inTok: u.promptTokenCount, outTok: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
  }

  /* 실패 응답(200 이 아님)을 오류 종류로 나눈다. retry: 잠깐 기다렸다 다시 보낼 만한 오류인지, waitSec: 구글이 알려 준 대기 시간 */
  function classifyError(status, j) {
    const msg = String((j && j.error && j.error.message) || '');
    const all = JSON.stringify(j || {});
    if (status === 429 && /free_tier_requests|PerDay|per day/i.test(all)) {
      // 하루 한도는 미국 서부 자정에 다시 채워진다(rate-limits 문서). 한국 시각으로 여름(서머타임)은 오후 4시, 11월~3월 중순은 오후 5시
      return new AIError('quota-day', '오늘 무료 사용량을 다 썼어요. 한국 시각 오후 4~5시쯤(미국 서부 자정) 다시 채워져요. 그동안은 "프롬프트 복사해서 쓰기"를 이용해 주세요.', 'HTTP 429 day');
    }
    // 분당 한도·서버 일시 오류는 한 번 기다렸다 다시 보낸다 (502·504 도 일시 오류라 함께)
    if ([429, 500, 502, 503, 504].includes(status)) {
      const d = all.match(/"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/);
      const e = status === 429
        ? new AIError('quota-min', '잠깐 사이에 요청이 많았어요. 1분쯤 뒤 다시 눌러 주세요.', 'HTTP 429')
        : new AIError('http', `AI 서버가 잠시 바빠요(${status}). 잠시 뒤 다시 시도해 주세요.`, 'HTTP ' + status);
      e.retry = true; e.waitSec = d ? Math.min(60, Math.max(5, Number(d[1]))) : 20;
      return e;
    }
    if (status === 400 && /API key|API_KEY/i.test(msg)) return new AIError('badkey', 'API 키가 올바르지 않아요. ❓ 안내 탭에서 키를 다시 확인해 주세요.', 'HTTP 400 key');
    // 401: 공식 오류 표(api-errors)에서 '키가 없거나 틀리거나 만료됨'. 전에는 '서버 오류, 잠시 뒤 다시'로 나와 다시 눌러도 같은 실패가 났음
    if (status === 401) return new AIError('badkey', 'API 키가 올바르지 않거나 만료됐어요. ❓ 안내 탭에서 키를 다시 확인해 주세요.', 'HTTP 401');
    // 2026년부터 Gemini API 는 '제한 없는(Unrestricted)' 옛 키의 요청을 거절한다(api-key 문서) — 고치는 길을 함께 알려 준다
    if (status === 403) return new AIError('forbidden', '이 키로는 사용할 수 없어요. AI Studio 키 목록에서 키에 Unrestricted 표시가 있으면 Gemini API 전용으로 제한하거나 새 키를 만들어 주세요(❓ 안내 탭).', 'HTTP 403');
    if (status === 404) return new AIError('model', '모델 이름을 찾지 못했어요. ❓ 안내 탭에서 모델 이름을 비워 기본값으로 바꿔 보세요.', 'HTTP 404');
    // 그 밖의 400: 전에는 '서버 오류, 잠시 뒤 다시'라고만 나와 다시 눌러도 같은 실패가 났음 — 요청 내용을 바꾸라고 안내
    if (status === 400) return new AIError('http', 'AI가 요청을 받지 못했어요(400). 메모를 조금 줄이거나 바꿔 다시 시도해 주세요.', 'HTTP 400');
    return new AIError('http', `AI 서버 오류(${status})예요. 잠시 뒤 다시 시도해 주세요.`, 'HTTP ' + status);
  }

  /* turns: 이어지는 대화 [{role:'assistant'|'user', text}] — 분량 맞춤·다듬기 요청에 쓴다
   * opts.signal: 앱이 '새로 쓰기'·'점검하기' 등으로 이 요청을 버릴 때 멈춘다(버린 요청이 재시도·길이 맞춤으로 무료 한도를 계속 쓰지 않게) */
  async function generate(prompt, turns, opts) {
    turns = turns || [];
    opts = opts || {};
    const stopped = () => opts.signal && opts.signal.aborted;
    const abortErr = () => new AIError('aborted', '요청을 멈췄어요.');
    if (stopped()) throw abortErr();
    if (isMock()) { const o = await mockGenerate(prompt, turns); if (stopped()) throw abortErr(); return o; }
    if (!opts.key) throw new AIError('nokey', 'API 키가 없어요. 아래 칸이나 ❓ 안내 탭에서 키를 넣어 주세요.');
    const model = (opts.model || '').trim() || DEFAULT_MODEL;
    const body = JSON.stringify(buildBody(prompt, turns));

    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const onStop = () => ctrl.abort();
      if (opts.signal) opts.signal.addEventListener('abort', onStop, { once: true });
      let res, j;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.key },
          body,
        });
        j = await res.json().catch(() => ({}));
      } catch (e) {
        clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener('abort', onStop);
        if (stopped()) throw abortErr();
        if (/[^\x21-\x7E]/.test(opts.key)) throw new AIError('badkey', 'API 키에 영문·숫자가 아닌 글자가 섞여 있어요. ❓ 안내 탭에서 키를 다시 붙여 넣어 주세요.');
        if (e.name === 'AbortError') throw new AIError('timeout', '응답이 너무 오래 걸려 멈췄어요. 잠시 뒤 다시 눌러 주세요.');
        throw new AIError('network', '인터넷 연결을 확인해 주세요.');
      }
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onStop);
      if (stopped()) throw abortErr();

      if (res.ok) {
        const out = parseResponse(j);
        return { text: out.text, servedBy: out.servedBy || model };
      }
      const err = classifyError(res.status, j);
      if (err.kind === 'model') err.message = `모델 이름(${model})을 찾지 못했어요. ❓ 안내 탭에서 모델 이름을 비워 기본값으로 바꿔 보세요.`;
      if (err.retry && attempt < 1) {
        if (opts.onWait) opts.onWait(err.waitSec);
        await sleep(err.waitSec * 1000);
        if (stopped()) throw abortErr(); // 기다리는 동안 버린 요청은 다시 보내지 않는다
        continue;
      }
      throw err;
    }
  }

  /* 시험 모드: 메모 문장을 이어 붙여 그럴듯한 길이의 문단을 만든다. 분량 맞춤 요청이면 한도 안으로 줄인다 */
  async function mockGenerate(prompt, turns) {
    await sleep(500);
    const memo = (prompt.user.split('교사 메모(관찰 내용):')[1] || '').trim();
    const target = Number((prompt.user.match(/한글 약 (\d+)자/) || [])[1] || 500);
    const sentences = memo.split(/(?<=[.다함음임])\s+/).map(s => s.trim()).filter(Boolean);
    let para = sentences.map(s => s.replace(/[.\s]*$/, '').replace(/했다$|함$/, '함') + '.').join(' ');
    const last = turns.length ? turns[turns.length - 1].text : '';
    if (/넘어 나이스에 입력되지 않습니다/.test(last)) para = para.slice(0, Math.round(target * 0.95)) + '함.';
    else if (/더할 새 문장만/.test(last)) para = '시험 모드에서 더한 첫째 문장으로 활동 과정을 차례대로 정리함. 시험 모드에서 더한 둘째 문장으로 맡은 일을 끝까지 수행함.'; // 늘리기(방식 A)는 더할 문장만
    else if (/더 짧게|줄여/.test(last)) para = para.slice(0, Math.round(para.length * 0.7)) + '함.';
    else if (!turns.length && /행동특성/.test(prompt.user)) para = (para.replace(/[\s_A-Za-z0-9]/g, '') + '성실함').repeat(6).slice(0, target + 20) + '함.'; // 초과 사례(한글만으로 한도를 넘김)
    if (/넘어 나이스에 입력되지 않습니다/.test(last)) para = para.replace(/[\s_A-Za-z0-9]/g, '').slice(0, Math.round(target * 0.95)) + '함.';
    // 과장 허용 '[덧붙인 내용]' 목록을 요청했으면 처음 답 끝에 예시 목록을 붙인다(화면 시험용)
    if (!turns.length && [prompt.system, prompt.user].join('\n').includes('[덧붙인 내용')) para += '\n\n[덧붙인 내용 — 나이스에 넣지 않음]\n- ' + (sentences[0] || '시험 모드 덧붙임').replace(/[.\s]*$/, '').slice(0, 20);
    return { text: para, servedBy: 'mock' };
  }

  root.SMAI = { generate, buildBody, parseResponse, classifyError, DEFAULT_MODEL, isMock, AIError };
})(typeof self !== 'undefined' ? self : this);
