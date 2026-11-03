// background.js (Chrome Manifest V3 Service Worker)

// 아이콘 클릭 시 사이드 패널 자동 오픈 설정
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 프론트엔드로부터 AI 생성 요청 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GENERATE_AI') {
    handleAIGeneration(request.provider, request.prompt)
      .then((result) => sendResponse({ success: true, text: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 비동기 응답 대기
  }
});

async function handleAIGeneration(provider, prompt) {
  if (provider === 'claude') {
    return await generateViaClaude(prompt);
  } else if (provider === 'chatgpt') {
    return await generateViaChatGPT(prompt);
  }
  throw new Error('지원하지 않는 AI 제공자입니다.');
}

/* ── Claude Pro 웹 세션 연동 ── */
async function generateViaClaude(promptText) {
  const orgRes = await fetch('https://claude.ai/api/organizations', {
    credentials: 'include'
  });
  if (!orgRes.ok) {
    throw new Error('Claude.ai 로그인이 필요합니다. 새 탭에서 claude.ai에 먼저 로그인해 주세요.');
  }
  const orgs = await orgRes.json();
  if (!orgs || !orgs.length) {
    throw new Error('Claude 계정 정보를 가져올 수 없습니다.');
  }
  const orgId = orgs[0].uuid;

  const chatUuid = crypto.randomUUID();
  const createChatRes = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid: chatUuid, name: '생기부 초안 생성' })
  });
  if (!createChatRes.ok) {
    throw new Error('Claude 대화 세션을 생성하지 못했습니다.');
  }

  const compRes = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatUuid}/completion`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      prompt: promptText,
      timezone: 'Asia/Seoul',
      model: 'claude-3-5-sonnet-20241022'
    })
  });

  if (!compRes.ok) {
    throw new Error(`Claude 응답 실패 (상태 코드: ${compRes.status})`);
  }

  const reader = compRes.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.completion) fullText += data.completion;
        } catch (e) {}
      }
    }
  }

  return fullText.trim() || '답변을 완성하지 못했습니다. 다시 시도해 주세요.';
}

/* ── ChatGPT Plus 웹 세션 연동 ── */
async function generateViaChatGPT(promptText) {
  const sessionRes = await fetch('https://chatgpt.com/api/auth/session', {
    credentials: 'include'
  });
  if (!sessionRes.ok) {
    throw new Error('ChatGPT 로그인이 필요합니다. 새 탭에서 chatgpt.com에 먼저 로그인해 주세요.');
  }
  const sessionData = await sessionRes.json();
  const token = sessionData.accessToken;
  if (!token) {
    throw new Error('ChatGPT 로그인 토큰이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const messageRes = await fetch('https://chatgpt.com/backend-api/conversation', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      action: 'next',
      messages: [
        {
          id: crypto.randomUUID(),
          author: { role: 'user' },
          content: { content_type: 'text', parts: [promptText] }
        }
      ],
      model: 'gpt-4o',
      parent_message_id: crypto.randomUUID()
    })
  });

  if (!messageRes.ok) {
    throw new Error(`ChatGPT 요청 실패 (상태 코드: ${messageRes.status})`);
  }

  const reader = messageRes.body.getReader();
  const decoder = new TextDecoder();
  let lastText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          const parts = data.message?.content?.parts;
          if (parts && parts.length > 0) lastText = parts[0];
        } catch (e) {}
      }
    }
  }

  return lastText.trim() || '답변을 완성하지 못했습니다. 다시 시도해 주세요.';
}
