// js/report-ocr.js — 학생 탐구보고서 다중 이미지 Gemini Vision OCR & 프롬프트 자동화 가이드
(function() {
  'use strict';

  const MASTER_PROMPT_TEXT = `당신은 대한민국 고등학교 학교생활기록부 및 '교과세부능력 및 특기사항(교과세특)' 기재요령 전문가이자 문서 이미지 OCR 정밀 판독 AI입니다.
첨부된 학생들의 과제연구 설문지 또는 탐구보고서(수행평가 결과물) 이미지를 정밀 판독(OCR)하여, 구글 스프레드시트 및 엑셀에 바로 붙여넣을 수 있는 [마크다운 표] 형식으로 일괄 추출하고 나이스 훈령을 엄격히 준수한 교과세특 초안을 작성해 주세요.

[개인정보 보호 및 보안 필수 권장사항]
학생들의 설문지 및 탐구보고서 이미지에는 학생의 학습 기록과 소중한 개인정보가 포함되어 있습니다.
따라서 본 OCR 판독 및 분석 작업 시에는 학생 데이터 보호를 위해 '입력된 고객 데이터를 AI 모델 학습에 사용하지 않는다(No Model Training)'고 명시된 구글 교육용 계정(Google Workspace for Education, 예: @sch.hs.kr, @goedu.kr, @sen.go.kr 등 학교/교육청 공식 도메인 계정) 사용을 강력히 권장합니다.

[1. 이미지 OCR 판독 및 텍스트 정제 지침]
1. 학생의 손글씨, 흘림체, 연필 필기, 오탈자, 비문은 문맥을 면밀히 분석하여 올바른 학술 어휘로 자연스럽게 교정하여 판독할 것.
2. 수학 수식, 과학 기호, 영문 학술 용어(AI, 알고리즘, 모델링 등)는 원본 의미를 왜곡 없이 정확한 디지털 텍스트로 복원할 것.
3. 설문지 또는 보고서의 4대 핵심 항목(① 선정한 주제, ② 선정이유/동기, ③ 제미나이/AI와의 대화 핵심내용, ④ 참고문헌 및 링크)을 정확히 분별하여 추출할 것.

[2. 교과세특 문장 작성 9대 규칙 (엄격 준수)]
1. 시작 문구 고정: 첫 문장은 반드시 아래 형식으로 완벽하게 고정하여 시작할 것.
   - 형식: '과제연구 시 '[학생이 선정한 주제]'를 주제로 선택하였으며 AI를 활용해 학술자료를 조사하고 분석함.' (단, 주제명에 오타나 비문이 있다면 자연스럽게 교정하고, 주제명은 반드시 작은따옴표('')로 감쌀 것)
2. 팩트 기반 작성: 학생이 작성한 실제 역할, 의도, 줄거리, 소감만을 바탕으로 사실(Fact)만을 기술하며 없는 내용을 절대 조작하거나 과장하여 유추하지 않음. 학종 지원 여부가 '예'인 경우 진로 연계성을 더욱 뚜렷하게 부각함.
3. 문장 종결: 모든 문장의 마지막은 '-임', '-함', '-음' 등의 명사형 서술어로 끝맺음. (예: 분석함, 규명함, 성장함)
4. 주어 및 개인정보 사용 금지: 문장 내에 학생 이름, '이 학생은', '본인은', '학생' 등의 단어를 일절 사용하지 않음.
5. 문장 기호 강조 규칙: 첫 문장의 주제명을 포함해 문장 내에 등장하는 모든 '주제명', '작품 제목', '학생의 핵심 발언 및 인용 문구'는 반드시 작은따옴표('')로 감싸서 출력함. 가운뎃점(·) 등 기타 특수기호는 사용 금지.
6. 금지 표현: '이해함', '파악함', '느낌', '알게 됨' 등 교사가 외부에서 직접 관찰할 수 없는 학생의 내면적 사고/감정 표현 절대 금지. 오직 구체적인 행동과 탐구 활동 위주로 서술할 것.
7. 시제: 반드시 현재형 또는 완료 서술형 상태로 작성함. 단순 과거형 시제 사용 금지.
8. 글자 수 제한: 학생이 작성한 내용의 양에 따라서 유동적으로 구성하되, 공백 포함 최소 100자에서 최대 250자 이내(나이스 전산 약 300~750 Byte)로 작성할 것.
9. 출력 형식: 안내 문구나 사족 없이 아래 마크다운 표 형식으로만 바로 출력할 것.

[3. 출력 표 형식 (구글 시트/엑셀 1초 복사용)]
| 학번 | 성명 | 과목명 | 탐구주제 | 선정이유 | AI 대화핵심 | 참고링크 | 1,500B 교과세특 초안 |`;

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

      // 2. 젬스 스킬 파일 저장 버튼
      const btnSaveSkill = document.getElementById('btnSaveOcrSkill');
      if (btnSaveSkill) {
        btnSaveSkill.addEventListener('click', () => {
          OCR.downloadSkillFile();
          const origText = btnSaveSkill.textContent;
          btnSaveSkill.textContent = '스킬 파일 저장 완료!';
          setTimeout(() => { btnSaveSkill.textContent = origText; }, 2500);
        });
      }

      // 2-1. 프롬프트 복사 버튼
      const btnCopy = document.getElementById('btnCopyOcrMasterPrompt');
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          const ok = await OCR.copyMasterPrompt();
          const orig = btnCopy.textContent;
          if (ok) {
            btnCopy.textContent = '프롬프트 복사 완료!';
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
