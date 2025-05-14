const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: 'https://lee6097.github.io'
}));
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 메모리에서 관리되는 숫자
let pageViews = 0;
let messageCount = 0;

// 기존 루트 경로 (조회수 증가 제거)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 새로 추가: 조회수 증가 전용 API
app.get('/view', (req, res) => {
  pageViews++;
  console.log('Page Views:', pageViews);
  res.sendStatus(200);  // 응답 OK
});

// 메시지 보낼 때 메시지 수 증가
app.post('/chat', async (req, res) => {
  messageCount++;
  console.log('Message Count:', messageCount);  // 콘솔에서 확인
  // OpenAI API 처리 코드
  const { messages } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: messages,
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send('OpenAI 오류');
  }
});

// 관리자만 볼 수 있는 페이지
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.get('/admin', (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('❌ 접근 불가');
  }
  res.json({
    pageViews,
    messageCount
  });
});


// ✅ 아래로 대체
async function startServer() {
  await initializeMetrics();
  app.listen(3000, () => {
    console.log('✅ 서버가 3000번 포트에서 실행 중입니다');
  });
}
startServer();
