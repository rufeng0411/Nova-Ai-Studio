import jwt from 'jsonwebtoken';
import { userDb, appConfigDb } from '../database/db.js';
import { IS_PLATFORM, DISABLE_LOCAL_AUTH, IS_SAAS_MODE } from '../constants/config.js';
import { controlUserDb } from '../saas/db/control.js';
import { saasRequestStore } from '../saas/context.js';
import { getTenantPilotHome } from '../saas/tenant/paths.js';
import { wrapShareErrorHtml } from '../saas/markdownShareHtml.js';

// Use env var if set, otherwise auto-generate a unique secret per installation
const JWT_SECRET = process.env.JWT_SECRET || appConfigDb.getOrCreateJwtSecret();

// Optional API key middleware
const validateApiKey = (req, res, next) => {
  // Skip API key validation if not configured
  if (!process.env.API_KEY) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

function extractRefererTokenForPathPrefix(req, pathPrefix) {
  const refererHeader = req.headers.referer || req.headers.referrer;
  if (!refererHeader || Array.isArray(refererHeader)) {
    return null;
  }

  try {
    const refererUrl = new URL(
      refererHeader,
      `${req.protocol}://${req.get('host')}`,
    );
    if (!refererUrl.pathname.includes(pathPrefix)) {
      return null;
    }
    return refererUrl.searchParams.get('token');
  } catch {
    return null;
  }
}

function extractDashboardRefererToken(req) {
  return extractRefererTokenForPathPrefix(req, '/memory-dashboard');
}

// PD-SAAS-FORK VAP P0-0: iframe preview sibling assets inherit ?token= from parent HTML Referer.
function extractPreviewRefererToken(req) {
  if (process.env.PILOTDECK_PREVIEW_REFERER_AUTH === '0') {
    return null;
  }
  return extractRefererTokenForPathPrefix(req, '/preview/')
    || extractRefererTokenForPathPrefix(req, '/share/doc/');
}

function isMarkdownShareHtmlRoute(req) {
  const path = req.path || '';
  return path.startsWith('/share/doc/')
    || /^\/api\/projects\/[^/]+\/share\/markdown\//u.test(path);
}

function sendShareAuthDenied(res, message) {
  return res.status(401).type('text/html; charset=utf-8').send(
    wrapShareErrorHtml(message, { title: '需要登录' }),
  );
}

async function lookupAuthUser(decoded) {
  if (IS_SAAS_MODE) {
    return controlUserDb.getUserById(decoded.userId);
  }
  return userDb.getUserById(decoded.userId);
}

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
  // PD-SAAS-FORK: SaaS always requires JWT even when local auth is disabled elsewhere.
  // Platform / no-login mode: use single database user
  if ((IS_PLATFORM || DISABLE_LOCAL_AUTH) && !IS_SAAS_MODE) {
    try {
      const user = userDb.getFirstUser();
      if (!user) {
        return res.status(500).json({ error: 'No user found in database (restart server after DB init)' });
      }
      req.user = user;
      return next();
    } catch (error) {
      console.error('Auth bypass mode error:', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  // Normal OSS JWT validation
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Also check query param for SSE endpoints (EventSource can't set headers)
  if (!token && req.query.token) {
    token = req.query.token;
  }
  // Memory dashboard static assets inherit the iframe document URL as Referer,
  // but do not inherit the query string onto app.js/app.css requests.
  if (!token) {
    token = extractDashboardRefererToken(req);
  }
  if (!token) {
    token = extractPreviewRefererToken(req);
  }

  if (!token) {
    if (isMarkdownShareHtmlRoute(req)) {
      return sendShareAuthDenied(res, '链接已失效或未登录，请返回 Nova 重新分享。');
    }
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const user = await lookupAuthUser(decoded);
    if (!user) {
      if (isMarkdownShareHtmlRoute(req)) {
        return sendShareAuthDenied(res, '登录已过期，请返回 Nova 重新分享。');
      }
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // Auto-refresh: if token is past halfway through its lifetime, issue a new one
    if (decoded.exp && decoded.iat) {
      const now = Math.floor(Date.now() / 1000);
      const halfLife = (decoded.exp - decoded.iat) / 2;
      if (now > decoded.iat + halfLife) {
        const newToken = generateToken(user);
        res.setHeader('X-Refreshed-Token', newToken);
      }
    }

    req.user = user;
    if (IS_SAAS_MODE) {
      const tenantId = user.tenant_id ?? user.tenantId;
      if (tenantId) {
        return saasRequestStore.run(
          {
            tenantId,
            tenantPilotHome: getTenantPilotHome(tenantId),
            userId: user.id ?? user.userId ?? null,
            role: typeof user.role === 'string' ? user.role : null,
          },
          () => next(),
        );
      }
    }
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (isMarkdownShareHtmlRoute(req)) {
      return sendShareAuthDenied(res, '登录已过期，请返回 Nova 重新分享。');
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Generate JWT token
const generateToken = (user) => {
  const payload = IS_SAAS_MODE
    ? {
        userId: user.id,
        tenantId: user.tenant_id ?? user.tenantId,
        role: user.role,
        username: user.username,
      }
    : {
        userId: user.id,
        username: user.username,
      };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

// WebSocket authentication function
const authenticateWebSocket = async (token) => {
  // PD-SAAS-FORK: SaaS WebSocket connections require a valid JWT.
  if ((IS_PLATFORM || DISABLE_LOCAL_AUTH) && !IS_SAAS_MODE) {
    try {
      const user = userDb.getFirstUser();
      if (user) {
        return { id: user.id, userId: user.id, username: user.username };
      }
      return null;
    } catch (error) {
      console.error('Platform mode WebSocket error:', error);
      return null;
    }
  }

  // Normal OSS JWT validation
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user actually exists in database (matches REST authenticateToken behavior)
    const user = await lookupAuthUser(decoded);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      userId: user.id,
      username: user.username,
      tenantId: user.tenant_id ?? decoded.tenantId,
      role: user.role ?? decoded.role,
    };
  } catch (error) {
    console.error('WebSocket token verification error:', error);
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket,
  JWT_SECRET
};
