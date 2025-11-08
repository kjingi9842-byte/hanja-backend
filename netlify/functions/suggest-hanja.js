// 파일 경로: netlify/functions/suggest-hanja.js

// Google GenAI 라이브러리를 가져옵니다.
const { GoogleGenAI } = require('@google/genai');

// 환경 변수에서 API 키를 안전하게 불러옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// GoogleGenAI 인스턴스 초기화
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ⬇️ --- [CORS 해결] 허용할 헤더 목록 --- ⬇️
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // '*'는 "모든 도메인"을 허용한다는 뜻입니다.
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
// ⬆️ --- [CORS 해결] --- ⬆️

// Netlify Functions의 기본 핸들러
exports.handler = async (event) => {

    // ⬇️ --- [CORS 해결] 브라우저의 'OPTIONS' (사전 요청) 처리 --- ⬇️
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // "처리할 내용 없음"
            headers: corsHeaders,
            body: '',
        };
    }
    // ⬆️ --- [CORS 해결] --- ⬆️

    // 1. POST 요청이 아닌 경우 차단 (기존 코드)
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Invalid JSON' };
    }

    const userInput = body.userInput;

    if (!userInput || !GEMINI_API_KEY) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Missing input or API Key' };
    }

    // --- AI 요청 프롬프트 ---
    const prompt = `당신은 한국어-한문 단어 번역 전문가입니다. 사용자의 요청을 이해하고, 가장 적합한 2글자 한문 단어 3개를 제안하세요. 각 단어는 한글로 된 간결한 설명이 포함되어야 하며, 구성 한자 각각에 대해 한글로 음과 뜻이 포함되어야 합니다. 출력은 반드시 다음 JSON 스키마를 따르는 유효한 JSON 객체여야 합니다: { "original_text": string, "suggestions": [{ "hanja": string, "meaning": string, "characters": [{ "character": string, "eum": string, "meaning": string }] }] }.
    만약 입력이 한국어가 아니라면, 'suggestions' 필드는 빈 배열이어야 하고, 'message' 필드는 입력이 한국어가 아님을 설명하고 가능하다면 적절한 한문 단어를 제안해야 합니다.
    사용자 입력: "${userInput}"`;

    try {
        // Gemini 모델 호출
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-05-20',
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

        // AI 응답 처리
        const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;

        return {
            statusCode: 200,
            headers: { 
                ...corsHeaders, // [CORS 해결] 성공 응답에도 허가증 추가
                'Content-Type': 'application/json' 
            },
            body: jsonText // AI가 생성한 JSON을 그대로 반환
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders, // [CORS 해결] 실패 응답에도 허가증 추가
            body: JSON.stringify({ message: 'AI 서버 처리 중 오류가 발생했습니다.' })
        };
    }
};
