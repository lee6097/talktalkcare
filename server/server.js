const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors({ origin: 'https://lee6097.github.io' }));
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const systemPrompt = process.env.SYSTEM_PROMPT;

let pageViews = 0;
let messageCount = 0;

async function initializeMetrics() {
  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    if (error.message.includes('no rows returned')) {
      await supabase.from('metrics').insert([{ id: 1, pageViews: 0, messageCount: 0 }]);
    } else {
      console.error('초기화 오류:', error.message);
    }
  } else if (data) {
    pageViews = data.pageViews || 0;
    messageCount = data.messageCount || 0;
  }
}

async function updateMetrics() {
  const { error } = await supabase
    .from('metrics')
    .update({ pageViews, messageCount })
    .eq('id', 1);

  if (error) console.error('Supabase 업데이트 오류:', error.message);
}

// ✅ Google 검색 함수
async function searchGoogle(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;

  try {
    const response = await axios.get(url);
    const items = response.data.items;
    if (items && items.length > 0) {
      return items.slice(0, 2).map(item => `- [${item.title}](${item.link})`).join('\n');
    } else {
      return '';
    }
  } catch (error) {
    console.error('Google 검색 오류:', error.message);
    return '';
  }
}

// ✅ 메인 채팅 API
app.post('/chat', async (req, res) => {
  messageCount++;
  await updateMetrics();
  const { messages } = req.body;

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages
  ];

  try {
    // 1. 기본 응답 생성
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: fullMessages
    });
    const reply = completion.choices[0].message.content;

    // 2. 마지막 발화 여부 판단
    const userQuestion = messages[messages.length - 1]?.content || '';
    const checkFinal = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: "system",
          content: "이 메시지가 건강 상담 대화의 마지막에 해당하는가? 적절하면 'yes', 아니라면 'no'만 소문자로 대답해."
        },
        {
          role: "user",
          content: userQuestion
        }
      ]
    });

    const isFinal = checkFinal.choices[0].message.content.trim().toLowerCase().includes('yes');

    // 3. 출처 붙이기
    if (isFinal) {
      const links = await searchGoogle(userQuestion);
      if (links) {
        return res.json({ reply: `${reply}\n\n🔗 출처:\n${links}` });
      }
    }

    return res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).send('OpenAI 오류');
  }
});

// 📈 조회수
app.get('/view', async (req, res) => {
  pageViews++;
  await updateMetrics();
  res.sendStatus(200);
});

// 📄 루트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 🔐 관리자 페이지
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
app.get('/admin', (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('❌ 접근 불가');
  }
  res.json({ pageViews, messageCount });
});

// 🚀 서버 실행
async function startServer() {
  await initializeMetrics();
  app.listen(3000, () => {
    console.log('✅ 서버가 3000번 포트에서 실행 중입니다');
  });
}

startServer();
