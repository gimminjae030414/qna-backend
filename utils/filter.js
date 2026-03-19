// 중고등학생 대상 비속어 필터
// 실제 비속어는 변형 표현(초성, 스페이스 삽입 등)도 포함

const BAD_WORDS = [
  // 욕설/비속어
  '씨발', '씨팔', 'ㅅㅂ', '시발', '시팔',
  '개새끼', 'ㄱㅅㄲ', '개새',
  '병신', 'ㅂㅅ', '븅신',
  '지랄', 'ㅈㄹ',
  '미친', '미친놈', '미친년',
  '꺼져', '뒤져', '뒤지',
  '닥쳐', '닥쳐라',
  '새끼', 'ㅅㄲ',
  '존나', 'ㅈㄴ', '좆나',
  '좆', 'ㅈ같',
  '보지', '자지',
  '창녀', '걸레',
  '찐따', '장애',
  '바보', '멍청', // 가벼운 욕이지만 게시판 품위 유지
  '개소리', '헛소리',
];

// 정규식 생성 (단순 포함 여부 체크)
const BAD_WORD_PATTERNS = BAD_WORDS.map(
  (word) => new RegExp(word.split('').join('\\s*'), 'i')
);

/**
 * 텍스트에 비속어 포함 여부 확인
 * @param {string} text
 * @returns {boolean}
 */
const hasBadWord = (text) => {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, ''); // 공백 제거 후 검사
  return BAD_WORD_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * 텍스트에서 비속어를 *** 로 치환
 * @param {string} text
 * @returns {string}
 */
const filterBadWords = (text) => {
  if (!text) return text;
  let filtered = text;
  BAD_WORDS.forEach((word) => {
    const pattern = new RegExp(word.split('').join('\\s*'), 'gi');
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  });
  return filtered;
};

module.exports = { hasBadWord, filterBadWords };
