const db = require('../config/mysql');

(async () => {
  try {
    const [rows] = await db.query('SELECT 1');
    console.log('MySQL connected successfully');
    process.exit();
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    process.exit(1);
  }
})();
