function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  safeNumber
};
