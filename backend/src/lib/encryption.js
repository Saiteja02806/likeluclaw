const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

function encrypt(text) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.includes('placeholder')) {
    throw new Error('TOKEN_ENCRYPTION_KEY not configured. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.includes('placeholder')) {
    throw new Error('TOKEN_ENCRYPTION_KEY not configured');
  }
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generatePassword(length = 12) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

module.exports = { encrypt, decrypt, generateToken, generatePassword };
