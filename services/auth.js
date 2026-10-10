const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = 'erp-crm-middleware';
const SCOPE = 'sales-orders:sync';

// Constant-time comparison that does not leak the length of the secret
function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/**
 * OAuth 2.0 client credentials grant (RFC 6749, section 4.4).
 * Expects grant_type, client_id and client_secret; returns a signed JWT access token.
 */

function tokenHandler(req, res) {
    const { JWT_SECRET, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, TOKEN_TTL_SECONDS } = process.env;
    const ttl = parseInt(TOKEN_TTL_SECONDS, 10) || 900; // 15 minutes by default

    res.set('Cache-Control', 'no-store');

    if (!JWT_SECRET || !OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
        return res.status(500).json({ error: 'server_error' });
    }

    const { grant_type, client_id, client_secret } = req.body || {};

    if (grant_type !== 'client_credentials') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    const okId = safeEqual(client_id, OAUTH_CLIENT_ID);
    const okSecret = safeEqual(client_secret, OAUTH_CLIENT_SECRET);
    if (!(okId && okSecret)) {
        return res.status(401).json({ error: 'invalid_client' });
    }

    const accessToken = jwt.sign({ scope: SCOPE }, JWT_SECRET, {
        algorithm: 'HS256',
        subject: client_id,
        issuer: ISSUER,
        expiresIn: ttl,
    });

    return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: ttl, scope: SCOPE });
}


/**
 * Protects a route: requires a valid Bearer JWT that carries the given scope.
 */
function requireAuth(requiredScope) {
    return (req, res, next) => {
        const [type, token] = (req.get('Authorization') || '').split(' ');

        if (type !== 'Bearer' || !token) {
            return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'invalid_token' });
        }

        try {
            // The algorithm is pinned so a token cannot choose its own (e.g. "none")
            const payload = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: ['HS256'],
                issuer: ISSUER,
            });

            if (!(payload.scope || '').split(' ').includes(requiredScope)) {
                return res.status(403).json({ error: 'insufficient_scope' });
            }

            req.auth = payload;
            return next();
        } catch (err) {
            // Bad signature, wrong issuer, or expired token
            return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'invalid_token' });
        }
    };
}

module.exports = { tokenHandler, requireAuth };