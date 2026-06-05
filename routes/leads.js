const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

// ✅ Use memoryStorage — Vercel filesystem is read-only
const upload = multer({ storage: multer.memoryStorage() });

// Utility: role-based authorization
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// ----------------------
// Submit new lead
// ----------------------
router.post(
  '/',
  authMiddleware,
  authorizeRoles('marketer', 'manager'),
  upload.single('lead_image'),
  async (req, res) => {
    try {
      const {
        lead_type,
        location,
        contact_name,
        contact_role,
        phone,
        email,
        visit_date,
        interest_level,
        notes,
        next_action,
        follow_up_date,
        services
      } = req.body;

      const servicesArray = services
        ? Array.isArray(services)
          ? services
          : [services]
        : [];

      // ✅ Convert file buffer to base64 string instead of saving to disk
      let imagePath = null;
      if (req.file) {
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        imagePath = `data:${mimeType};base64,${base64}`;
      }

      const result = await pool.query(
        `INSERT INTO school_leads
        (lead_type, location, contact_name, contact_role, phone, email, visit_date, interest_level, notes, next_action, follow_up_date, image_path, submitted_by_id, services, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()) RETURNING *`,
        [
          lead_type,
          location,
          contact_name,
          contact_role,
          phone,
          email,
          visit_date,
          interest_level,
          notes,
          next_action,
          follow_up_date,
          imagePath,
          req.user.id,
          servicesArray
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error inserting lead:', err);
      res.status(500).send('Server error');
    }
  }
);

// ----------------------
// Get leads
// ----------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT l.*, u.username AS submitted_by
      FROM school_leads l
      LEFT JOIN users u ON l.submitted_by_id = u.id
      ORDER BY l.created_at DESC
    `;
    let params = [];

    // Marketers only see their leads
    if (req.user.role === 'marketer') {
      query = `
        SELECT l.*, u.username AS submitted_by
        FROM school_leads l
        LEFT JOIN users u ON l.submitted_by_id = u.id
        WHERE l.submitted_by_id = $1
        ORDER BY l.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leads:', err.message);
    res.status(500).send('Server error');
  }
});

// ----------------------
// Delete lead by ID
// ----------------------
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    // Only managers can delete
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Forbidden: only managers can delete leads' });
    }

    const result = await pool.query(
      'DELETE FROM school_leads WHERE id = $1 RETURNING *',
      [leadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully ✅' });
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;