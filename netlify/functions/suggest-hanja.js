// 파일 경로: netlify/functions/suggest-hanja.js
// 'Vertex AI (gemini-pro)'와 'GOOGLE_CREDENTIALS'를 사용하는 최종본입니다.

// 1. 'Vertex AI' 부품을 가져옵니다.
const { VertexAI } = require('@google-cloud/aiplatform');

// 2. CORS '출입 허가증' 헤더입니다.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 3. Google Cloud 'VIP 출입증'(.json)을 읽어오는 설정
// Netlify 환경 변수에서 'GOOGLE_CREDENTIALS' (아까 붙여넣은 긴 JSON 텍스트)를 읽습니다.
const credentialsJson = process.env.GOOGLE_CREDENTIALS;
let clientOptions;

if (credentialsJson) {
  // Netlify 금고에서 읽은 JSON 텍스트를 객체로 변환합니다.
  const credentials = JSON.parse(credentialsJson);
  clientOptions = {
    projectId: credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replace(/\\n/g, '\n'), // Netlify가 '\n'을 '\\n'으로 저장하는 문제를 해결
    },
    location: 'us-central1', // Vertex AI는 위치가 필요합니다.
  };
} else {
  // (만약 GOOGLE_CREDENTIALS가 없으면, 오류를 냅니다)
  console.error("치명적 오류: GOOGLE_CREDENTIALS 환경 변수가 없습니다.");
}

// 4. Vertex AI 클라이언트 초기화
const vertex_ai = new VertexAI(clientOptions);

// 5. 'gemini-pro' (대형 본점) 모델 설정
const generativeModel = vertex_ai.getGenerativeModel({
  model: 'gemini-pro',
});


// Netlify Functions의 기본 핸들러
exports.handler = async (event) => {

    // 6. [CORS 해결] 브라우저의 '사전 요청(OPTIONS)'을 처리합니다.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders,
            body: '',
        };
    }

    // 7. POST 요청이 아닌 경우 차단
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    // 8. Cargo.site에서 보낸 요청 본문(body)을 받습니다.
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Invalid JSON' };
    }

    const userInput = body.userInput;

    if (!userInput) {
        return { statusCode: 400, headers: corsHeaders, body: 'Bad Request: Missing userInput' };
    }
    
    if (!credentialsJson) {
         return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: 'AI 서버 설정 오류: GOOGLE_CREDENTIALS가 없습니다.' }) };
    }

    // 9. AI에게 보낼 지시(프롬프트) - 3개 제안
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
        // 10. 'Vertex AI (gemini-pro)' 모델 호출
        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
            },
        };
        
        const result = await generativeModel.generateContent(request);
        const jsonText = result.response.candidates[0].content.parts[0].text;

        // 11. Cargo.site로 성공 응답(JSON)과 '허가증'을 함께 보냅니다.
        return {
          statusCode: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          },
          body: jsonText,
        };

    } catch (error) {
        // 12. 실패 시에도 '허가증'을 보냅니다. (로그 확인용)
        console.error("Vertex AI (Gemini Pro) Error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'AI 서버 처리 중 오류가 발생했습니다.' })
        };
    }
};
