// 파일 경로: netlify/functions/suggest-hanja.js

const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 한자 검증 함수
function isValidHanja(text) {
    const hanjaRegex = /^[\u4E00-\u9FFF]+$/;
    return hanjaRegex.test(text);
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders,
            body: '',
        };
    }

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

    const prompt = `You are a Korean-to-Hanja translation expert.

User input: "${userInput}"

CRITICAL RULES:
1. The "hanja" field MUST contain ONLY Chinese characters (漢字), NOT Korean Hangul
2. Each character in "hanja" MUST be from Unicode range U+4E00-U+9FFF
3. Suggest exactly 3 two-character Hanja words
4. Provide Korean readings (eum) and meanings in Korean for the "meaning", "eum", and character "meaning" fields

Examples:
✓ CORRECT: "hanja": "勤勉" (Chinese characters)
✗ WRONG: "hanja": "근면" (Korean Hangul - DO NOT USE)

If input is not Korean, return empty suggestions array with appropriate message.

Output must be valid JSON following this exact schema:
{
  "original_text": "${userInput}",
  "suggestions": [
    {
      "hanja": "勤勉",
      "meaning": "부지런하고 힘씀",
      "characters": [
        {"character": "勤", "eum": "근", "meaning": "부지런할"},
        {"character": "勉", "eum": "면", "meaning": "힘쓸"}
      ]
    }
  ]
}`;

    try {
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        original_text: { type: "string" },
                        suggestions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hanja: { 
                                        type: "string",
                                        description: "MUST be Chinese characters only (U+4E00-U+9FFF)"
                                    },
                                    meaning: { type: "string" },
                                    characters: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                character: { 
                                                    type: "string",
                                                    description: "Single Chinese character"
                                                },
                                                eum: { type: "string" },
                                                meaning: { type: "string" }
                                            },
                                            required: ["character", "eum", "meaning"]
                                        }
                                    }
                                },
                                required: ["hanja", "meaning", "characters"]
                            }
                        },
                        message: { type: "string" }
                    },
                    required: ["original_text", "suggestions"]
                }
            }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text();
        const parsedResult = JSON.parse(jsonText);

        // ✅ 한자 검증 추가
        if (parsedResult.suggestions && parsedResult.suggestions.length > 0) {
            parsedResult.suggestions = parsedResult.suggestions.filter(suggestion => {
                if (!isValidHanja(suggestion.hanja)) {
                    console.warn(`Invalid hanja detected: ${suggestion.hanja}`);
                    return false;
                }
                
                if (suggestion.characters) {
                    suggestion.characters = suggestion.characters.filter(char => 
                        isValidHanja(char.character)
                    );
                }
                
                return suggestion.characters && suggestion.characters.length > 0;
            });

            if (parsedResult.suggestions.length === 0) {
                parsedResult.message = "AI가 한글로 응답했습니다. 다시 시도해주세요.";
            }
        }

        return {
            statusCode: 200,
            headers: { 
                ...corsHeaders,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(parsedResult)
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'AI 서버 처리 중 오류가 발생했습니다.' })
        };
    }
};
