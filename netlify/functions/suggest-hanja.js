// netlify/functions/suggest-hanja.js
// Claude API를 사용한 한자 추천 함수

exports.handler = async (event) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 요청 본문 파싱
    const { text } = JSON.parse(event.body);

    // 입력 검증
    if (!text || text.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '텍스트를 입력해주세요.' })
      };
    }

    console.log('한자 추천 요청:', text);

    // Claude API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // 빠르고 저렴한 모델
        max_tokens: 1000,
        temperature: 0.3, // 일관성 있는 결과를 위해 낮은 temperature
        messages: [{
          role: 'user',
          content: `다음 한국어 단어/문구에 가장 적합한 한자 표기를 3-5개 추천해주세요.

입력된 단어: "${text}"

응답 규칙:
1. 반드시 JSON 형식으로만 출력
2. 마크다운 코드 블록이나 추가 설명 금지
3. 각 한자는 실제로 해당 단어에 사용되는 정확한 표기여야 함

JSON 형식:
{
  "suggestions": [
    {
      "hanja": "漢字",
      "meaning": "각 글자의 의미와 왜 이 단어에 적합한지 설명"
    }
  ]
}`
        }]
      })
    });

    // API 응답 확인
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API Error:', response.status, errorData);
      throw new Error(`Claude API 오류: ${response.status}`);
    }

    // 응답 파싱
    const data = await response.json();
    const content = data.content[0].text.trim();
    
    console.log('Claude 응답:', content.substring(0, 100) + '...');
    
    // JSON 추출 (```json 태그가 있을 경우 제거)
    let jsonText = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }
    
    // JSON 파싱
    const result = JSON.parse(jsonText);

    // 결과 검증
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      throw new Error('Invalid response format');
    }

    console.log('성공:', result.suggestions.length, '개 추천');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error in suggest-hanja function:', error);
    
    // 에러 응답
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '한자 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        suggestions: [],
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
