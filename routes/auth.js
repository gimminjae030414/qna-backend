const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
const pool = require('../db');

const SALT_ROUNDS = 12;

// ─── 회원가입 ──────────────────────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    let { username, password, inviteCode } = req.body;

    // 입력값 검증
    if (!username || !password || !inviteCode) {
      return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
    }

    // XSS 방지: HTML 태그 제거
    username = sanitizeHtml(username, { allowedTags: [], allowedAttributes: {} }).trim();

    // 사용자명 규칙 검사
    if (!/^[a-zA-Z0-9가-힣_]{2,20}$/.test(username)) {
      return res.status(400).json({ error: '사용자명은 2~20자의 한글/영문/숫자/_만 가능합니다.' });
    }

    // 비밀번호 길이 검사
    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
    }

    // 추천 코드 검증 (타이밍 어택 방지: 항상 같은 시간 소요)
    const correctCode = process.env.INVITE_CODE || 'PHYSICS2024';
    const isValidCode = inviteCode === correctCode;
    if (!isValidCode) {
      return res.status(403).json({ error: '추천 코드가 올바르지 않습니다.' });
    }

    // 중복 확인
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 사용 중인 사용자명입니다.' });
    }

    // 비밀번호 해싱 후 저장
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      [username, hashed, 'student']
    );

    res.status(201).json({ message: '회원가입 완료! 로그인해주세요.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 로그인 ──────────────────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    }

    // 파라미터 바인딩으로 SQL 인젝션 방지
    const result = await pool.query(
      'SELECT id, username, password, role FROM users WHERE username = $1',
      [username]
    );

    // 존재 여부와 무관하게 항상 bcrypt 실행 (타이밍 어택 방지)
    const user = result.rows[0];
    const dummyHash = '$2b$12$invalidhashfortimingreasonsonlyXXXXXXXXXXXXXXXX';
    const isMatch = await bcrypt.compare(password, user ? user.password : dummyHash);

    if (!user || !isMatch) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 발급 (2시간 만료)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
