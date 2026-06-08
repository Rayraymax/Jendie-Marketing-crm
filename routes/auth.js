const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// -------------------------
// Register new user
// -------------------------
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    let { role } = req.body;

    const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    const isBootstrap = userCount.rows[0].count === 0;

    if (!isBootstrap) {
      const token = req.headers.authorization?.split(' ')[1] || null;
      if (!token) return res.status(401).json({ error: 'Registration is admin-only' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!['manager', 'admin', 'super_admin'].includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    role = isBootstrap ? 'super_admin' : (role || 'marketer');
    if (!['marketer', 'staff', 'manager', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashedPassword, role]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------
// Login user
// -------------------------
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid credentials' });

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('jwtToken', token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 1000
    });

    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
