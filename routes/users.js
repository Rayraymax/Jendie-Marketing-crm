const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs'); // ✅
const jwt = require('jsonwebtoken');

const ADMIN_ROLES = ['manager', 'admin', 'super_admin'];
const VALID_ROLES = ['marketer', 'staff', 'manager', 'admin', 'super_admin'];

// -------------------------
// Auth middleware
// -------------------------
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// -------------------------
// Role restriction middleware
// -------------------------
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// -------------------------
// GET ALL USERS (manager only)
// -------------------------
router.get('/', authMiddleware, authorizeRoles(...ADMIN_ROLES), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------
// CREATE USER (manager only)
// -------------------------
router.post('/', authMiddleware, authorizeRoles(...ADMIN_ROLES), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Please provide username, password, and role' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, hashedPassword, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------
// UPDATE USER (admin only)
// -------------------------
router.put('/:id', authMiddleware, authorizeRoles(...ADMIN_ROLES), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const userId = parseInt(req.params.id, 10);

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updates = [];
    const params = [];
    if (username) {
      params.push(username);
      updates.push(`username = $${params.length}`);
    }
    if (role) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (password) {
      params.push(await bcrypt.hash(password, 10));
      updates.push(`password = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, username, role, created_at`,
      params
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------
// DELETE USER (admin only)
// -------------------------
router.delete('/:id', authMiddleware, authorizeRoles(...ADMIN_ROLES), async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
