require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// DB 초기화 (import만 해도 실행됨)
require('./db');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const replyRoutes = require('./routes/replies');
const adminRoutes = require('./routes/admin');

const app = express();

// ─── 보안 헤더 (Helmet) ─────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // 이미지 접근 허용
  })
);

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // JSON 페이로드 크기 제한
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── 업로드 이미지 정적 제공 ──────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── 전체 요청 Rate Limit (IP당 15분에 200회) ────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use(globalLimiter);

// ─── 로그인 전용 Rate Limit (IP당 15분에 5회) ────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
});
app.use('/api/auth/login', loginLimiter);

// ─── 회원가입 Rate Limit (IP당 1시간에 5회) ──────────────────────────────────
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: '가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.' },
});
app.use('/api/auth/register', registerLimiter);

// ─── 라우터 ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/admin', adminRoutes);

// ─── 404 처리 ─────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: '존재하지 않는 경로입니다.' });
});

// ─── 전역 에러 핸들러 ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 서버 실행 중: http://localhost:${PORT}`));
