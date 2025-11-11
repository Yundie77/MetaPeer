const fs = require('fs');
const crypto = require('crypto');

/**
 * Calcula el hash de un fichero utilizando el algoritmo indicado (sha1 por defecto).
 * Devuelve una promesa que resuelve al hash en hexadecimal.
 */
function fileHash(filePath, algorithm = 'sha1') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', (error) => reject(error));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = {
  fileHash
};
