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
  authorizeRoles('marketer', 'manager', 'admin', 'super_admin'),
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
        services,
        pipeline_stage = 'New',
        lead_source = 'Field Visit'
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
        (lead_type, location, contact_name, contact_role, phone, email, visit_date, interest_level, notes, next_action, follow_up_date, image_path, submitted_by_id, services, pipeline_stage, lead_source, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()) RETURNING *`,
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
          servicesArray,
          pipeline_stage,
          lead_source
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
// Update lead details / pipeline stage
// ----------------------
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const allowedStages = ['New', 'Contacted', 'Proposal', 'Won', 'Lost'];
    const allowedFields = [
      'lead_type',
      'location',
      'contact_name',
      'contact_role',
      'phone',
      'email',
      'visit_date',
      'interest_level',
      'notes',
      'next_action',
      'follow_up_date',
      'pipeline_stage',
      'lead_source'
    ];

    const existing = await pool.query('SELECT * FROM school_leads WHERE id = $1', [leadId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const lead = existing.rows[0];
    const isOwner = lead.submitted_by_id === req.user.id;
    const isAdmin = ['manager', 'admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden: you can only update your own leads' });

    if (req.body.pipeline_stage && !allowedStages.includes(req.body.pipeline_stage)) {
      return res.status(400).json({ error: 'Invalid pipeline stage' });
    }

    const updates = [];
    const params = [];
    allowedFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        params.push(req.body[field] || null);
        updates.push(`${field} = $${params.length}`);
      }
    });

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(leadId);
    const result = await pool.query(
      `UPDATE school_leads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating lead:', err);
    res.status(500).send('Server error');
  }
});

// ----------------------
// Delete lead by ID
// ----------------------
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    if (!['manager', 'admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: only admins can delete leads' });
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
