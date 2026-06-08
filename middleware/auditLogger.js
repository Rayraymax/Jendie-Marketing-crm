const pool = require('../db');

async function logAudit(req, action, entityType, entityId = null, details = {}) {
  try {
    const actor = req.user || {};
    await pool.query(
      `INSERT INTO audit_logs
        (actor_id, actor_username, actor_role, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actor.id || null,
        actor.username || details.username || null,
        actor.role || null,
        action,
        entityType,
        entityId,
        JSON.stringify(details),
        req.ip || req.headers['x-forwarded-for'] || null
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = logAudit;
