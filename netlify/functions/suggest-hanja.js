// 파일 경로: netlify/functions/suggest-hanja.js
// 404 오류(모델 이름)가 수정된 최종본입니다.

const { GoogleGenAI } = require('@google/genai');

// 환경 변수에서 API 키를 안전하게 불러옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// CORS 허용 헤더 (모든 도메인 허용)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Netlify Functions의 기본 핸들러
exports.handler = async (event) => {

    // 1. 브라우저의 'OPTIONS' (사전 요청) 처리
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, 
            headers: corsHeaders,
            body: '',
        };
    }

    // 2. POST 요청이 아닌 경우 차단
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    // 3. 요청 본문(body) 파싱
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Invalid JSON' };
    }

    const userInput = body.userInput;

    // 4. 입력값 및 API 키 확인
    if (!userInput || !GEMINI_API_KEY) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Missing input or API Key' };
    }

    // 5. AI에게 보낼 지시(프롬프트)
    const prompt = `당신은 한국어-한문 단어 번역 전문가입니다. 사용자의 요청을 이해하고, 가장 적합하다고 생각하는 2글자 한문 단어 **단 1개**만 제안하세요.

    규칙:
    1.  제안은 **단 1개**여야 합니다.
    2.  'hanja' 필드에는 **반드시 한자(漢字)**만 포함되어야 합니다. (예: "愛情"). **절대로 한글("사랑")을 반환하지 마세요.**
    3.  각 단어는 한글로 된 간결한 설명이 포함되어야 합니다.
    4.  구성 한자 각각에 대해 한글로 음과 뜻이 포함되어야 합니다.
    5.  만약 적절한 한자를 찾지 못하거나, 입력이 한국어가 아니라면, 'suggestions' 배열을 빈 배열( [ ] )로 반환하세요.
    
    출력은 반드시 다음 JSON 스키마를 따르는 유효한 JSON 객체여야 합니다:
    { "original_text": string, "suggestions": [{ "hanja": string, "meaning": string, "characters": [{ "character": string, "eum": string, "meaning": string }] }] }
    
    사용자 입력: "${userInput}"`;

    try {
        // 6. Gemini 모델 호출
        const response = await ai.models.generateContent({
            // ⬇️ --- [수정됨] 'latest'를 제거한 올바른 모델 이름 --- ⬇️
            model: 'gemini-1.5-flash',
            // ⬆️ --- [수정됨] --- ⬆️
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "original_text": { "type": "STRING" },
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

        // 7. AI 응답 처리
        const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        
        return {
            statusCode: 200,
            headers: { 
                ...corsHeaders,
                'Content-Type': 'application/json' 
            },
            body: jsonText 
        };

    } catch (error) {
        // 8. 오류 발생 시 로그 기록 및 응답
        console.error("Gemini API Error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'AI 서버 처리 중 오류가 발생했습니다.' })
        };
    }
};
