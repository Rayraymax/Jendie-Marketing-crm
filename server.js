const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const leadsRoutes = require('./routes/leads');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

const app = express();

// -------------------------
// CORS — lock to your frontend origins
// -------------------------
const allowedOrigins = [
  'https://school-crm-indol.vercel.app',  // Vercel frontend
  'http://localhost:5000',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// -------------------------
// Body parsing (only once)
// -------------------------
app.use(express.json());

// -------------------------
// Serve frontend static files
// -------------------------
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Default route → login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Public login route
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// -------------------------
// Auth middleware
// Returns 401 JSON for API calls, redirects for page requests
// -------------------------
function ensureAuthenticated(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || null;

  if (!token) {
    // If it's an API call return JSON 401, otherwise redirect to login
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    return res.redirect('/login.html');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.redirect('/login.html');
  }
}

// -------------------------
// Protected page routes
// -------------------------
app.get('/dashboard.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/index.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------
// API routes
// -------------------------
app.use('/api/leads', leadsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

// -------------------------
// Global error handler
// -------------------------
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});