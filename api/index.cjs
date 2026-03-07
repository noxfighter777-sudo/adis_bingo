const express = require("express");
const path = require("path");
require("dotenv/config");

const app = express();

// Add CORS headers for proper browser communication
app.use((req, res, next) => {
  const allowedOrigin = process.env.NODE_ENV === 'production' ? false : req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma,Set-Cookie,Cookie');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Serve static files
const publicPath = path.resolve(process.cwd(), "public");
app.use(express.static(publicPath));

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Basic license endpoints (simplified)
app.get('/api/license/status', (req, res) => {
  res.json({ activated: false, message: "License system simplified for deployment" });
});

app.get('/api/license/machine-id', (req, res) => {
  res.json({ 
    machineId: `SERVERLESS_${Date.now().toString(36).toUpperCase()}`,
    message: "Simplified machine ID for serverless environment"
  });
});

// Basic auth endpoints
app.post('/api/auth/login', (req, res) => {
  res.json({ 
    user: { id: 1, username: 'admin', role: 'admin' },
    message: "Login simplified for deployment"
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ 
    user: { id: 1, username: 'admin', role: 'admin' },
    message: "User info simplified for deployment"
  });
});

// Activation endpoint
app.post('/api/activate', (req, res) => {
  try {
    const { encryptedData } = req.body;
    
    if (!encryptedData) {
      return res.status(400).json({ 
        success: false, 
        error: "No activation data provided" 
      });
    }
    
    // Simplified activation - always succeed for deployment
    console.log("Activation attempt:", encryptedData.substring(0, 50) + "...");
    
    res.json({ 
      success: true, 
      message: "Activation successful (simplified for deployment)",
      activatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Activation error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Activation failed" 
    });
  }
});

// Basic game endpoints
app.get('/api/games', (req, res) => {
  res.json({ 
    games: [],
    message: "Games API simplified for deployment"
  });
});

app.get('/api/employees', (req, res) => {
  res.json({ 
    employees: [],
    message: "Employees API simplified for deployment"
  });
});

// Catch all other API routes with a simple response
app.use('/api/*', (req, res) => {
  res.json({ 
    message: `API endpoint ${req.method} ${req.path} simplified for deployment`,
    path: req.path,
    method: req.method
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: 'API simplified for deployment'
  });
});

// Export for Vercel serverless
module.exports = app;
