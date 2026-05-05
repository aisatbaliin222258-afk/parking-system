require('dotenv').config();
const express = require("express");
const connectDB = require("./config/db");
const { initializeDatabase, createDefaultAlertRules } = require("./config/dbInit");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const socket = require("./socket");

const app = express();

app.use(express.json());

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://parkingsystem-dc7c0.web.app';
// For development, allow localhost on common dev ports
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5500', 'http://localhost:5501', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501'];
const NODE_ENV = process.env.NODE_ENV || 'development';
const allowedOrigins = NODE_ENV === 'production' ? [FRONTEND_ORIGIN] : [FRONTEND_ORIGIN, ...DEV_ORIGINS];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: true
}));

// Additional CORS and Private Network Access support for browser preflight
// Modern browsers require Access-Control-Allow-Private-Network on preflight when a public HTTPS page
// calls a local/private backend. NOTE: This only helps if the backend is actually reachable from the public web.
app.use((req, res, next) => {
// Mirror CORS headers for non-cors middleware consumers
  res.setHeader('Access-Control-Allow-Origin', req.get('origin') || FRONTEND_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // If this is a CORS preflight and the browser requested private network access, allow it
  if (req.method === 'OPTIONS') {
    // If the browser requests private network access, it sends Sec-Fetch-Site and Sec-Fetch-Dest headers.
    // Respond with Access-Control-Allow-Private-Network to permit access (Chrome's Private Network Access spec)
    if (req.headers['access-control-request-private-network'] === 'true' || req.headers['sec-fetch-site'] === 'cross-site') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    return res.sendStatus(204);
  }
  next();
});

// Note: connect to MongoDB and initialize DB inside startServer()

// Routes (REST)
// Stream relay for RTSP -> HLS
app.use('/api/stream', require('./routes/streamRoutes'));
// Serve generated HLS streams publicly
const path = require('path');
app.use('/streams', express.static(path.join(__dirname, 'streams')));

app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/vehicles", require("./routes/vehicleRoutes"));
app.use("/api/setting", require("./routes/settingRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));

// Detection & whitelist/blacklist routes
app.use("/api/detection", require("./routes/detectionRoutes"));
// Also expose shorthand endpoint /api/detect for existing dashboards
app.use("/api/detect", require("./routes/detectionRoutes"));
app.use("/api/whitelist", require("./routes/whitelistRoutes"));
app.use("/api/blacklist", require("./routes/blacklistRoutes"));

// Alert rules and stats
app.use("/api/alerts", require("./routes/alertRulesRoutes"));
app.use("/api/stats", require("./routes/statsRoutes"));
// Events query routes
app.use("/api/events/query", require("./routes/eventsQueryRoutes"));

// Analytics routes (summary, live, history, and receive detection events)
app.use('/api/analytics', require('./routes/analyticsRoutes'));
// Also expose detection/event endpoint at /api/detection/event for Python compatibility
app.use('/api/detection/event', require('./routes/analyticsRoutes'));


// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "CCTV Detection System API",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "CCTV AI Detection System API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      detection: "/api/detection",
      whitelist: "/api/whitelist",
      blacklist: "/api/blacklist",
      alerts: "/api/alerts",
      cameras: "/api/cameras",
    },
  });
});

// Create HTTP server and attach Socket.io for real-time alerts
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    credentials: true
  },
});

// Socket auth middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && (socket.handshake.auth.token || socket.handshake.auth.apiKey || socket.handshake.auth.key);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
    const apiKeys = (process.env.API_KEYS || 'dev-key').split(',').map(k=>k.trim()).filter(Boolean);

    if (!token) {
      // Allow anonymous sockets for dashboard connections; mark as anonymous
      socket.auth = { method: 'anonymous' };
      return next();
    }

    // Check API key first
    if (apiKeys.includes(token)) {
      socket.auth = { method: 'apiKey', key: token };
      return next();
    }

    // Try JWT
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.auth = { method: 'jwt', payload };
      return next();
    } catch (err) {
      // If token invalid, allow anonymous but log warning
      console.warn('Socket auth failed, allowing anonymous socket');
      socket.auth = { method: 'anonymous' };
      return next();
    }
  } catch (err) {
    // On error, allow connection but mark as anonymous
    socket.auth = { method: 'anonymous' };
    return next();
  }
});

// Expose io through socket module
socket.setIO(io);

io.on("connection", (sock) => {
  console.log(`Socket connected: ${sock.id}`);
  // Attach auth info for handlers
  console.log('Socket auth:', sock.auth);

  sock.on("subscribe", (room) => {
    if (room) {
      sock.join(room);
      console.log(`Socket ${sock.id} joined room ${room}`);
    }
  });

  sock.on("unsubscribe", (room) => {
    if (room) {
      sock.leave(room);
      console.log(`Socket ${sock.id} left room ${room}`);
    }
  });

  sock.on("disconnect", () => {
    console.log(`Socket disconnected: ${sock.id}`);
  });
});

// Graceful error handling and startup sequence
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Attempt to listen on a list of candidate ports and fall back if one is busy
const portsToTry = [ process.env.PORT ? Number(process.env.PORT) : 3000, 5000, 0 ]; // 0 => random free port
let currentPortIndex = 0;

function tryListenOnIndex(index) {
  const port = portsToTry[index];
  if (port === 0) {
    console.log('Attempting to listen on an ephemeral random free port');
  } else {
    console.log(`Attempting to listen on port ${port}`);
  }

  server.once('listening', () => {
    const addr = server.address();
    const boundPort = typeof addr === 'string' ? addr : addr.port;
    console.log(`Server is listening on port ${boundPort} (host 0.0.0.0)`);
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use.`);
      const next = index + 1;
      if (next < portsToTry.length) {
        console.log(`Trying next port option...`);
        tryListenOnIndex(next);
      } else {
        console.error('No available ports to bind to. Exiting.');
        process.exit(1);
      }
    } else if (err.code === 'EACCES') {
      console.error(`Insufficient privileges to bind to port ${port}.`);
      process.exit(1);
    } else {
      console.error('Server listen error:', err);
      process.exit(1);
    }
  });

  try {
    server.listen(port, '0.0.0.0');
  } catch (err) {
    console.error('listen() threw an exception:', err);
    process.exit(1);
  }
}

async function startServer() {
  try {
    // Connect to DB with retries but do not crash the whole app if DB is unavailable
    const dbConnected = await connectDB({ retries: 5, initialDelayMs: 1000 });
    if (!dbConnected) {
      console.warn('Proceeding to start the server without an active database connection. Some features may be limited.');
    }

    try {
      await initializeDatabase();
      await createDefaultAlertRules();
      console.log('✓ Database initialization complete');
    } catch (err) {
      console.error('Error during database initialization (non-fatal):', err);
    }

    // Try binding to ports in portsToTry list
    tryListenOnIndex(0);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
