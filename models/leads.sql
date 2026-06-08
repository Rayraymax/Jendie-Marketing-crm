-- leads.sql (clean, professional)

-- ✅ Users table (if not already existing)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- marketer, staff, manager, admin, super_admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ✅ Leads table (school_name removed)
CREATE TABLE IF NOT EXISTS school_leads (
    id SERIAL PRIMARY KEY,
    lead_type VARCHAR(50) NOT NULL DEFAULT 'School',        -- School / Firm / Individual
    location VARCHAR(255),
    contact_name VARCHAR(255),
    contact_role VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    visit_date DATE,
    interest_level VARCHAR(50),                              -- Interested, Needs Follow-up, Not Interested
    notes TEXT,
    next_action VARCHAR(100),
    follow_up_date DATE,
    image_path TEXT,
    services TEXT[],                                         -- Array of selected services
    pipeline_stage VARCHAR(40) NOT NULL DEFAULT 'New',        -- New, Contacted, Proposal, Won, Lost
    lead_source VARCHAR(100) DEFAULT 'Field Visit',
    submitted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- Link to submitting user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE school_leads
ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(40) NOT NULL DEFAULT 'New',
ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100) DEFAULT 'Field Visit',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE users
SET role = 'super_admin'
WHERE id = (SELECT MIN(id) FROM users)
  AND role IN ('manager', 'admin', 'staff', 'marketer');

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_username VARCHAR(100),
    actor_role VARCHAR(50),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ✅ Services table
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- ✅ Pre-populate services
INSERT INTO services (name) VALUES
('Speed Governors'),
('Trackers'),
('Insurance'),
('Dashcams'),
('CCTV'),
('Fuel Management'),
('TrackMyKid')
ON CONFLICT (name) DO NOTHING;  -- Prevent duplicates

-- ✅ Indexes for faster filtering/search
CREATE INDEX IF NOT EXISTS idx_leads_interest_level ON school_leads(interest_level);
CREATE INDEX IF NOT EXISTS idx_leads_submitted_by ON school_leads(submitted_by_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON school_leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON school_leads(pipeline_stage);
