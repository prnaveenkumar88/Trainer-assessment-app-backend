const crypto = require('crypto');

const generateOTP = (length = 6) => {
  const safeLength = Number.isInteger(length) && length > 0
    ? length
    : 6;

  const min = 10 ** (safeLength - 1);
  const max = (10 ** safeLength) - 1;
  return String(crypto.randomInt(min, max + 1));
};

module.exports = {
  generateOTP
};
