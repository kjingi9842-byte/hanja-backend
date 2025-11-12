// 파일 경로: netlify/functions/suggest-hanja.js
// Claude API를 사용하고, CORS (OPTIONS) 요청을 해결한 최종본입니다.

// 1. Claude '부품'을 가져옵니다.
const Anthropic = require('@anthropic-ai/sdk');

// 2. Netlify 환경 변수에서 Claude API 키를 불러옵니다.
const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 3. CORS '출입 허가증' 헤더입니다.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // '*'는 모든 사이트(Cargo 포함)를 허용한다는 뜻입니다.
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Netlify Functions의 기본 핸들러
exports.handler = async (event) => {

    // 4. [CORS 해결] 브라우저의 '사전 요청(OPTIONS)'을 처리합니다.
    // 브라우저가 "요청 보내도 돼요?"라고 물으면, 이 코드가 "네!"(허가증)를 보냅니다.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // "처리할 내용 없음"
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

    // Cargo HTML의 JavaScript가 "userInput"이라는 키로 데이터를 보냈다고 가정합니다.
    const userInput = body.userInput;

    if (!userInput) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Missing userInput' };
    }

    // 7. Claude AI에게 보낼 지시(프롬프트)
    // (Gemini 프롬프트와 거의 동일하며, 3개를 제안하도록 했습니다.)
    const prompt = `당신은 한국어-한문 단어 번역 전문가입니다. 사용자의 요청을 이해하고, 가장 적합하다고 생각하는 2글자 한문 단어 3개를 제안하세요.

    규칙:
    1.  제안은 3개여야 합니다.
    2.  'hanja' 필드에는 반드시 한자(漢字)만 포함되어야 합니다. (예: "愛情"). 절대로 한글("사랑")을 반환하지 마세요.
    3.  각 단어는 한글로 된 간결한 설명이 포함되어야 합니다.
    4.  구성 한자 각각에 대해 한글로 음과 뜻이 포함되어야 합니다.

    사용자 입력: "${userInput}"

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
        // 8. Claude API 호출 (Haiku 모델 사용 - 빠르고 저렴함)
        const msg = await claude.messages.create({
          model: "claude-3-haiku-20240307", 
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        // 9. Claude의 응답을 받습니다.
        const claudeResponse = msg.content[0].text;

        // (Claude가 가끔 응답을 ```json ... ```으로 감싸는 경우가 있어, 이를 제거합니다.)
        const cleanedJson = claudeResponse.replace(/```json\n/g, '').replace(/```/g, '');

        // 10. Cargo.site로 성공 응답(JSON)과 '허가증'을 함께 보냅니다.
        return {
          statusCode: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
          body: cleanedJson,
        };

    } catch (error) {
        console.error("Claude API Error:", error);
        // 11. 실패 시에도 '허가증'을 보냅니다.
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'AI 서버 처리 중 오류가 발생했습니다.' })
        };
    }
};
