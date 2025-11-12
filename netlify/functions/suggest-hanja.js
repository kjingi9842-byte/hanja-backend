// 파일 경로: netlify/functions/suggest-hanja.js
// 'Google Gemini API' (gemini-pro 모델)를 사용하는 최종본입니다.

// 1. Google '부품'을 가져옵니다.
const { GoogleGenAI } = require('@google/genai');

// 2. Netlify 환경 변수에서 Gemini API 키를 불러옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 3. CORS '출입 허가증' 헤더입니다.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Cargo 사이트 허용
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Netlify Functions의 기본 핸들러
exports.handler = async (event) => {

    // 4. [CORS 해결] 브라우저의 '사전 요청(OPTIONS)'을 처리합니다.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders,
            body: '',
        };
    }

    // 5. POST 요청이 아닌 경우 차단
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    // 6. Cargo.site에서 보낸 요청 본문(body)을 받습니다.
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Invalid JSON' };
    }

    const userInput = body.userInput;

    if (!userInput || !GEMINI_API_KEY) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Missing userInput or API Key' };
    }

    // 7. Gemini AI에게 보낼 지시(프롬프트) - 3개 제안
    const prompt = `당신은 한국어-한문 단어 번역 전문가입니다. 사용자의 요청을 이해하고, 가장 적합하다고 생각하는 2글자 한문 단어 3개를 제안하세요.

    규칙:
    1.  제안은 3개여야 합니다.
    2.  'hanja' 필드에는 반드시 한자(漢字)만 포함되어야 합니다. (예: "愛情"). 절대로 한글("사랑")을 반환하지 마세요.
    3.  각 단어는 한글로 된 간결한 설명이 포함되어야 합니다.
    4.  구성 한자 각각에 대해 한글로 음과 뜻이 포함되어야 합니다.
    
    출력은 반드시 다음 JSON 스키마를 따르는 유효한 JSON 객체여야 합니다. 다른 말은 하지 말고 JSON만 반환하세요:
    {
      "suggestions": [
        {
          "hanja": "不屈",
          "meaning": "굽히지 않는 의지",
          "characters": [
            {"character": "不", "eum": "불", "meaning": "아니다"},
            {"character": "屈", "eum": "굴", "meaning": "굽히다"}
          ]
        }
      ]
    }`;
    
    try {
        // 8. Gemini API 호출 (안정적인 'gemini-pro' 모델 사용)
        const response = await ai.models.generateContent({
          model: "gemini-pro", // ⬅️ 안정적인 표준 모델
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: "OBJECT",
                  properties: {
                      "suggestions": {
                          type: "ARRAY",
                          items: {
                              type: "OBJECT",
                              properties: {
                                  "hanja": { "type": "STRING" },
                                  "meaning": { "type": "STRING" },
                                  "characters": {
                                      type: "ARRAY",
                                      items: {
                                          type: "OBJECT",
                                          properties: {
                                              "character": { "type": "STRING" },
                                              "eum": { "type": "STRING" },
                                              "meaning": { "type": "STRING" }
                                          }
                                      }
                                  }
                              }
                          }
                      }
                  }
              }
          }
        });

        // 9. Gemini의 응답을 받습니다.
        const jsonText = response.candidates?.[0].content.parts[0].text;
        
        // 10. Cargo.site로 성공 응답(JSON)과 '허가증'을 함께 보냅니다.
        return {
          statusCode: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
          body: jsonText,
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        // 11. 실패 시에도 '허가증'을 보냅니다. (로그 확인용)
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'AI 서버 처리 중 오류가 발생했습니다.' })
        };
    }
};
