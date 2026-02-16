const crypto = require('crypto');

const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'; // sin l
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O
const SYMBOLS = '#@$%&!?+-/*';
const DIGITS = '23456789'; // sin 0 ni 1
const PASSWORD_ALPHABET = `${LOWERCASE}${UPPERCASE}${SYMBOLS}${DIGITS}`;

function generateReadablePassword(length = 10) {
  const size = Number(length);
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('La longitud de la contraseña debe ser un entero positivo.');
  }

  let password = '';
  for (let i = 0; i < size; i += 1) {
    const index = crypto.randomInt(0, PASSWORD_ALPHABET.length);
    password += PASSWORD_ALPHABET[index];
  }
  return password;
}

module.exports = {
  LOWERCASE,
  UPPERCASE,
  DIGITS,
  SYMBOLS,
  PASSWORD_ALPHABET,
  generateReadablePassword
};
