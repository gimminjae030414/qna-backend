const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { filterBadWords, hasBadWord } = require('../utils/filter');

// ─── 답글 작성 ─────────────────────────────────────────────────────────────────
// POST /api/replies/:postId
router.post('/:postId', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    if (isNaN(postId)) return res.status(400).json({ error: '잘못된 요청입니다.' });

    let { content } = req.body;
    if (!content) return res.status(400).json({ error: '내용을 입력해주세요.' });

    // XSS 방지
    content = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();

    // 길이 제한
    if (content.length > 2000) return res.status(400).json({ error: '답글이 너무 깁니다. (최대 2000자)' });

    // 비속어 필터링 (차단이 아닌 치환)
    content = filterBadWords(content);

    // 게시글 존재 확인
    const post = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    const isAdmin = req.user.role === 'admin';

    const result = await pool.query(
      'INSERT INTO replies (post_id, user_id, content, is_admin) VALUES ($1, $2, $3, $4) RETURNING *',
      [postId, req.user.id, content, isAdmin]
    );

    res.status(201).json({
      message: '답글이 등록되었습니다.',
      reply: { ...result.rows[0], username: req.user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─── 답글 삭제 (본인 or 관리자) ───────────────────────────────────────────────
// DELETE /api/replies/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: '잘못된 요청입니다.' });

    const reply = await pool.query('SELECT user_id FROM replies WHERE id = $1', [id]);
    if (reply.rows.length === 0) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });

    if (req.user.role !== 'admin' && reply.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await pool.query('DELETE FROM replies WHERE id = $1', [id]);
    res.json({ message: '답글이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
