const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const API_KEYS = (process.env.API_KEYS || 'dev-key').split(',').map(k=>k.trim()).filter(Boolean);

function authenticateExpress(req, res, next){
  try{
    // Accept Authorization: Bearer <jwt> OR x-api-key header
    const auth = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (apiKey && API_KEYS.includes(apiKey)){
      req.client_auth = { method: 'apiKey', key: apiKey };
      return next();
    }

    if (!auth) return res.status(401).json({ error: 'Authorization header or x-api-key required' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
    const token = parts[1];

    try{
      const payload = jwt.verify(token, JWT_SECRET);
      req.client_auth = { method: 'jwt', payload };
      return next();
    }catch(err){
      return res.status(401).json({ error: 'Invalid token' });
    }
  }catch(err){
    return res.status(500).json({ error: 'Auth middleware error' });
  }
}

module.exports = { authenticateExpress, JWT_SECRET, API_KEYS };
