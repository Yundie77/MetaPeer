const crypto = require('crypto');
const { MAX_ASSIGNMENT_SHUFFLE } = require('../app/constants');

function buildSeededRandom(seed) {
  if (seed === undefined || seed === null) {
    return null;
  }

  let state = crypto.createHash('sha256').update(String(seed)).digest().readUInt32LE(0);
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray(items, randomFn = null) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomFn ? Math.floor(randomFn() * (i + 1)) : crypto.randomInt(0, i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function buildDerangement(ids) {
  if (ids.length < 2) {
    return ids.slice();
  }

  for (let attempt = 0; attempt < MAX_ASSIGNMENT_SHUFFLE; attempt += 1) {
    const shuffled = shuffleArray(ids);
    const valid = ids.every((value, index) => value !== shuffled[index]);
    if (valid) {
      return shuffled;
    }
  }

  const rotated = ids.slice(1);
  rotated.push(ids[0]);
  return rotated;
}

module.exports = {
  buildSeededRandom,
  shuffleArray,
  buildDerangement
};
