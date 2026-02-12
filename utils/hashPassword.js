const bcrypt = require('bcryptjs');

const passwords = ['admin123', 'trainer123', 'assessor123'];

passwords.forEach(pwd => {
  const hash = bcrypt.hashSync(pwd, 10);
  console.log(`${pwd} → ${hash}`);
});
