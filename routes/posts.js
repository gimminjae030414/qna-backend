const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { hasBadWord } = require('../utils/filter');

const SANITIZE_OPTS = { allowedTags: [], allowedAttributes: {} };

// ─── 질문 목록 조회 ────────────────────────────────────────────────────────────
// GET /api/posts?page=1&limit=10
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM posts');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT p.id, p.title, p.image_url, p.created_at,
              u.username,
              COUNT(r.id) AS reply_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN replies r ON r.post_id = p.id
       GROUP BY p.id, u.username
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      posts: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 질문 상세 조회 ────────────────────────────────────────────────────────────
// GET /api/posts/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: '잘못된 요청입니다.' });

    const postResult = await pool.query(
      `SELECT p.id, p.title, p.content, p.image_url, p.created_at,
              u.username
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    // 답글 조회 (관리자 답글 최상단)
    const replyResult = await pool.query(
      `SELECT r.id, r.content, r.is_admin, r.created_at,
              u.username
       FROM replies r
       JOIN users u ON u.id = r.user_id
       WHERE r.post_id = $1
       ORDER BY r.is_admin DESC, r.created_at ASC`,
      [id]
    );

    res.json({
      post: postResult.rows[0],
      replies: replyResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 질문 작성 ─────────────────────────────────────────────────────────────────
// POST /api/posts
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    let { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    }

    // XSS 방지
    title = sanitizeHtml(title, SANITIZE_OPTS).trim();
    content = sanitizeHtml(content, SANITIZE_OPTS).trim();

    // 길이 제한
    if (title.length > 200) return res.status(400).json({ error: '제목이 너무 깁니다. (최대 200자)' });
    if (content.length > 5000) return res.status(400).json({ error: '내용이 너무 깁니다. (최대 5000자)' });

    // 비속어 검사
    if (hasBadWord(title) || hasBadWord(content)) {
      return res.status(400).json({ error: '부적절한 언어가 포함되어 있습니다.' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      'INSERT INTO posts (user_id, title, content, image_url) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, title, content, imageUrl]
    );

    res.status(201).json({ message: '질문이 등록되었습니다.', postId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 질문 삭제 (본인 or 관리자) ───────────────────────────────────────────────
// DELETE /api/posts/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: '잘못된 요청입니다.' });

    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    if (req.user.role !== 'admin' && post.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ message: '게시글이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
