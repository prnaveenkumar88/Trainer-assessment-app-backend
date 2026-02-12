const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/mysql');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.user_id,
      role: user.role,
      name: user.name,
      email: user.email   // ⭐ Added
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

exports.login = async (req, res) => {
  try {

    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      token,
      role: user.role,
      name: user.name,
      email: user.email   // ⭐ Added
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
