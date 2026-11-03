// bridge.js — 웹페이지(localhost / vercel.app)의 사이드바와 크롬 확장프로그램(background.js)을 연결하는 브리지
window.dataset_neis_ext_installed = 'true';
document.documentElement.dataset.neisExtension = 'installed';

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== 'NEIS_AI_REQUEST') return;
  const { requestId, provider, prompt } = event.data;
  chrome.runtime.sendMessage({ action: 'GENERATE_AI', provider, prompt }, (response) => {
    window.postMessage({
      type: 'NEIS_AI_RESPONSE',
      requestId,
      response: response || { success: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : '응답 없음' }
    }, '*');
  });
});
