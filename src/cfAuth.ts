import * as jose from 'jose';
import { Request, Response, NextFunction } from 'express';

export interface CfAccessPayload {
  aud: string[];
  email?: string;
  type?: string;
  identity_nonce?: string;
  sub: string;
  iss: string;
  iat: number;
  exp: number;
}

let remoteJWKS: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
let cachedCertsUrl = '';

function getJwks(certsUrl: string) {
  if (!remoteJWKS || cachedCertsUrl !== certsUrl) {
    cachedCertsUrl = certsUrl;
    remoteJWKS = jose.createRemoteJWKSet(new URL(certsUrl));
  }
  return remoteJWKS;
}

export async function verifyCloudflareAccessJwt(token: string): Promise<{ valid: boolean; payload?: any; reason?: string }> {
  const rawTeamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
  const audience = process.env.CF_ACCESS_AUD;

  if (!rawTeamDomain || !audience) {
    return { valid: false, reason: 'CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is not configured in server environment' };
  }

  const teamDomain = rawTeamDomain.endsWith('/') ? rawTeamDomain.slice(0, -1) : rawTeamDomain;
  const certsUrl = `${teamDomain}/cdn-cgi/access/certs`;

  try {
    const JWKS = getJwks(certsUrl);
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: teamDomain,
      audience: audience
    });
    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, reason: err?.message || 'JWT verification failed' };
  }
}

export function maskSecret(val: string | undefined): string {
  if (!val) return '';
  if (val.length <= 8) return '********';
  return val.substring(0, 4) + '...' + val.substring(val.length - 4);
}

export async function requireCloudflareAccess(req: Request, res: Response, next: NextFunction) {
  const allowDevAdmin = process.env.ALLOW_DEV_ADMIN === 'true';
  const adminHostname = process.env.ADMIN_HOSTNAME || 'crm.happyhouse420.com';

  // 1. Host Isolation Check
  const reqHostHeader = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  const reqHost = reqHostHeader.split(':')[0].trim();

  // If host isolation is active and request is coming from Telegram public host or another non-admin host
  if (adminHostname && reqHost && reqHost !== adminHostname && reqHost !== 'localhost' && reqHost !== '127.0.0.1' && !allowDevAdmin) {
    console.warn(`[CF_ACCESS_BLOCKED] Host mismatch. Request host: '${reqHost}', expected ADMIN_HOSTNAME: '${adminHostname}'`);
    return res.status(403).json({
      success: false,
      error: 'HOST_MISMATCH',
      message: 'Admin endpoints are only accessible via the dedicated admin hostname'
    });
  }

  // 2. Cloudflare Access JWT verification
  const cfJwt = req.headers['cf-access-jwt-assertion'] as string | undefined;

  if (!cfJwt) {
    if (allowDevAdmin) {
      console.warn(`[CF_ACCESS_DEV] Missing Cf-Access-Jwt-Assertion header, but ALLOW_DEV_ADMIN=true. Allowing dev access.`);
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'CF_ACCESS_MISSING_TOKEN',
      message: 'Access denied: Missing Cloudflare Access JWT header (Cf-Access-Jwt-Assertion)'
    });
  }

  const result = await verifyCloudflareAccessJwt(cfJwt);
  if (!result.valid) {
    console.warn(`[CF_ACCESS_REJECTED] Invalid Cloudflare Access JWT: ${result.reason}`);
    return res.status(403).json({
      success: false,
      error: 'CF_ACCESS_INVALID_TOKEN',
      message: `Access denied: Invalid Cloudflare Access JWT (${result.reason})`
    });
  }

  (req as any).cfAccessUser = result.payload;
  return next();
}
