const fs = require('fs');
const multer = require('multer');
const { MAX_UPLOAD_SIZE_BYTES, UPLOAD_DIR } = require('./constants');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uploadZip = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES }
});

module.exports = { uploadZip };
