// js/report-ocr.js — 학생 탐구보고서 다중 이미지 Gemini Vision OCR 자동 판독기
(function() {
  'use strict';

  const OCR = {
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
})();
