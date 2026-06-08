const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const ADMIN_ROLES = ['manager', 'admin', 'super_admin'];

function authorizeAdmin(req, res, next) {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.get('/', authMiddleware, authorizeAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        al.id,
        al.actor_id,
        COALESCE(u.username, al.actor_username, 'System') AS actor_username,
        al.actor_role,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.ip_address,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
