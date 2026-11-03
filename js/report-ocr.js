// js/report-ocr.js — 학생 탐구보고서 다중 이미지 Gemini Vision OCR & 프롬프트 자동화 가이드
(function() {
  'use strict';

  const MASTER_PROMPT_TEXT = `당신은 대한민국 고등학교 학교생활기록부 및 과목별 세부능력및특기사항(세특) 기재요령 전문가입니다.
첨부된 학생들의 탐구보고서(또는 수행평가 결과물) 이미지를 정밀 분석하여, 구글 스프레드시트 및 엑셀에 바로 붙여넣을 수 있는 [마크다운 표] 형식으로 일괄 추출해 주세요.

[표 필수 열 구성 (구글 시트/엑셀 복사용)]:
| 학번 | 성명 | 과목명 | 탐구주제(보고서제목) | 핵심역량키워드 | 나이스 3단계 세특 초안(동기-과정-성장 400~500자) |

[세특 초안 작성 원칙]:
1. [동기 - 탐구활동 - 배우고느낀점(성장)] 3단계 구조를 유기적으로 연결된 완성된 한 문단으로 작성할 것.
2. 나이스 기준 공백 포함 400~500자 내외(1,200~1,500 Byte)로 풍부하고 구체적인 문장체로 서술할 것.
3. 교육부 기재금지 사항(교외 수상실적, 공인어학성적, 외부기관명, 특정 도서 저자명 등)은 100% 배제할 것.
4. 단순 지식 나열이 아니라, 학생이 어떤 의문과 가설을 가지고 어떤 탐구·실험·분석 과정을 거쳤는지 관찰 가능한 사실 위주로 개별화하여 서술할 것.

응답은 백틱(\`\`\`) 마크다운 표 형식으로 깔끔하게 출력해 주세요.`;

  const GEM_STEPS = [
    {
      img: 'assets/gemini-gem-step1.svg',
      title: '1단계: 학생 탐구보고서 사진 촬영 및 준비',
      desc: '스마트폰으로 학생들의 탐구보고서 또는 수행평가 결과물 사진을 촬영합니다. (JPG, PNG, PDF 모두 지원, 모둠 보고서나 낱장 스캔본도 가능)'
    },
    {
      img: 'assets/gemini-gem-step2.svg',
      title: '2단계: Gemini 접속 후 [새 Gem 만들기] 클릭',
      desc: 'Google Gemini(gemini.google.com)에 로그인한 뒤, 좌측 메뉴의 [Gems 매니저]를 누르고 [+ 새 Gem 만들기]를 클릭합니다.'
    },
    {
      img: 'assets/gemini-gem-step3.svg',
      title: '3단계: [지침] 란에 표준 마스터 프롬프트 붙여넣기',
      desc: 'Gem 이름을 [학생 보고서 세특 분석기]로 입력하고, [지침(Instructions)] 칸에 상단의 [표준 프롬프트 복사] 버튼으로 복사한 내용을 붙여넣고 [저장]합니다.'
    },
    {
      img: 'assets/gemini-gem-step4.svg',
      title: '4단계: 학생 보고서 사진 10~30장 일괄 업로드',
      desc: '완성된 Gem 대화창에 촬영한 학생 보고서 사진들을 한꺼번에 드래그 앤 드롭으로 올리고 "이 보고서들 세특 표로 정리해 줘"라고 전송합니다.'
    },
    {
      img: 'assets/gemini-gem-step5.svg',
      title: '5단계: 생성된 표를 구글 시트 / 엑셀에 1초 붙여넣기',
      desc: 'Gemini가 학번, 이름, 과목, 주제, 500자 세특 초안을 정리한 표를 복사(Ctrl+C)하여 구글 스프레드시트나 엑셀에 붙여넣기(Ctrl+V)하면 끝납니다!'
    }
  ];

  let currentGemStep = 0;

  const OCR = {
    getMasterPrompt() {
      return MASTER_PROMPT_TEXT;
    },

    async copyMasterPrompt() {
      try {
        await navigator.clipboard.writeText(MASTER_PROMPT_TEXT);
        return true;
      } catch (e) {
        return false;
      }
    },

    initModalGuide() {
      // 1. 모달 내부 탭 전환
      const tabs = document.querySelectorAll('.ocr-tab-btn');
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          tabs.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const targetTab = btn.getAttribute('data-ocr-tab');
          const paneGems = document.getElementById('ocr-pane-gems');
          const paneVision = document.getElementById('ocr-pane-vision');
          if (targetTab === 'gems') {
            if (paneGems) paneGems.classList.remove('ocr-hidden');
            if (paneVision) paneVision.classList.add('ocr-hidden');
          } else {
            if (paneGems) paneGems.classList.add('ocr-hidden');
            if (paneVision) paneVision.classList.remove('ocr-hidden');
          }
        });
      });

      // 2. 프롬프트 복사 버튼
      const btnCopy = document.getElementById('btnCopyOcrMasterPrompt');
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          const ok = await OCR.copyMasterPrompt();
          const orig = btnCopy.textContent;
          if (ok) {
            btnCopy.textContent = '✅ 프롬프트 복사 완료!';
            btnCopy.style.background = '#15803d';
            setTimeout(() => {
              btnCopy.textContent = orig;
              btnCopy.style.background = '#059669';
            }, 2500);
          } else {
            alert('클립보드 복사 권한이 없습니다. 텍스트 박스에서 직접 드래그 복사해 주세요.');
          }
        });
      }

      // 3. Gems 5단계 캐러셀 네비게이션
      const btnPrev = document.getElementById('btnGemPrev');
      const btnNext = document.getElementById('btnGemNext');
      if (btnPrev && btnNext) {
        btnPrev.addEventListener('click', () => {
          if (currentGemStep > 0) {
            currentGemStep--;
            OCR.updateGemStep();
          }
        });
        btnNext.addEventListener('click', () => {
          if (currentGemStep < GEM_STEPS.length - 1) {
            currentGemStep++;
            OCR.updateGemStep();
          }
        });
      }

      OCR.updateGemStep();
    },

    updateGemStep() {
      const step = GEM_STEPS[currentGemStep];
      if (!step) return;

      const imgEl = document.getElementById('gemSlideImg');
      const titleEl = document.getElementById('gemSlideTitle');
      const descEl = document.getElementById('gemSlideDesc');
      const counterEl = document.getElementById('gemSlideCounter');
      const btnPrev = document.getElementById('btnGemPrev');
      const btnNext = document.getElementById('btnGemNext');

      if (imgEl) imgEl.src = step.img;
      if (titleEl) titleEl.textContent = step.title;
      if (descEl) descEl.textContent = step.desc;
      if (counterEl) counterEl.textContent = `${currentGemStep + 1} / ${GEM_STEPS.length}`;

      if (btnPrev) btnPrev.disabled = (currentGemStep === 0);
      if (btnNext) btnNext.disabled = (currentGemStep === GEM_STEPS.length - 1);
    },

    async analyzeReportImage(file, apiKey, model = 'gemini-2.0-flash') {
      if (!apiKey) {
        throw new Error('Gemini API 키가 등록되지 않았습니다. 상단에서 API 키를 먼저 입력해 주세요.');
      }

      // 1. 이미지를 Base64로 인코딩
      const base64Data = await this.fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const prompt = `당신은 대한민국 고등학교 학교생활기록부 작성 및 학생부종합전형 진학지도 전문가입니다.
첨부된 학생 탐구보고서(또는 수행평가 결과물) 이미지를 정밀하게 OCR 판독하고, 학교생활기록부 과목별 세부능력 및 특기사항(세특) 초안을 작성해 주세요.

반드시 아래 JSON 형식으로만 응답하세요. 백틱(\`\`\`json) 기호 없이 순수 JSON 문자열만 출력하세요:
{
  "studentName": "학생 이름 (문서에서 발견된 성명, 식별 불가시 빈 문자열)",
  "studentNo": "학번 (예: 30105, 식별 불가시 빈 문자열)",
  "subject": "탐구 과목명 (예: 경제, 통합사회, 심화수학 등)",
  "title": "탐구 주제 또는 보고서 제목",
  "summary": "학생이 수행한 핵심 탐구 내용 2~3줄 요약",
  "competencies": "관찰된 교과 역량 (문제해결력, 비판적사고력, 전공탐구의지 등)",
  "setukDraft": "교육부 학생부 기재요령을 엄격히 준수한 '동기-탐구활동-배우고느낀점(성장)' 3단계 구조의 과목별 세특 초안 (공백 포함 400~500자 내외, 개별화되고 관찰 가능한 문장체)"
}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

      const body = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: "application/json"
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API 오류 (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      try {
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
      } catch (parseErr) {
        return {
          studentName: '',
          subject: '일반',
          title: '보고서 판독 완료',
          summary: rawText,
          setukDraft: rawText
        };
      }
    },

    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };

  window.ReportOCR = OCR;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OCR.initModalGuide());
  } else {
    OCR.initModalGuide();
  }
})();
