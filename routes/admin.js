const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// ─── 전체 사용자 목록 ──────────────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 사용자 삭제 ───────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: '잘못된 요청입니다.' });
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1 AND role != $2', [id, 'admin']);
    res.json({ message: '사용자가 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 전체 게시글 목록 ──────────────────────────────────────────────────────────
// GET /api/admin/posts
router.get('/posts', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.created_at, u.username
       FROM posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 게시글 삭제 ───────────────────────────────────────────────────────────────
// DELETE /api/admin/posts/:id
router.delete('/posts/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: '잘못된 요청입니다.' });
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ message: '게시글이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 추천 코드 변경 ────────────────────────────────────────────────────────────
// PATCH /api/admin/invite-code
// 실제 운영시엔 .env 파일을 직접 수정하는 게 안전하나, 편의상 런타임 변경도 지원
router.patch('/invite-code', verifyAdmin, (req, res) => {
  const { newCode } = req.body;
  if (!newCode || newCode.length < 4) {
    return res.status(400).json({ error: '추천 코드는 4자 이상이어야 합니다.' });
  }
  process.env.INVITE_CODE = newCode;
  res.json({ message: `추천 코드가 변경되었습니다: ${newCode}` });
});

// ─── 통계 ──────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [users, posts, replies] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['student']),
      pool.query('SELECT COUNT(*) FROM posts'),
      pool.query('SELECT COUNT(*) FROM replies'),
    ]);
    res.json({
      studentCount: parseInt(users.rows[0].count),
      postCount: parseInt(posts.rows[0].count),
      replyCount: parseInt(replies.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
