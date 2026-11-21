import { createHmac } from 'node:crypto';
import { AppError } from '../../../utils/app-error.js';
import {
  deriveKey,
  generateOpaqueToken,
  hashRefreshToken,
  secureEqual,
} from '../../../utils/identity-crypto.js';

const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessionIdPattern = /^([a-f\d]{24})\.([A-Za-z0-9_-]{43})$/i;

function unauthorized() {
  return new AppError('Authentication required', 401);
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function signAccessToken(payload, key) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const input = `${header}.${body}`;
  const signature = createHmac('sha256', key).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function verifyAccessToken(token, key, now) {
  if (typeof token !== 'string' || token.length > 2048) {
    throw unauthorized();
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    throw unauthorized();
  }

  const [headerPart, bodyPart, signature] = parts;
  const input = `${headerPart}.${bodyPart}`;
  const expected = createHmac('sha256', key)
    .update(input)
    .digest('base64url');

  if (!secureEqual(signature, expected)) {
    throw unauthorized();
  }

  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(bodyPart, 'base64url').toString());
    const nowSeconds = Math.floor(now.getTime() / 1000);

    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      !['customer', 'admin'].includes(payload.role) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= nowSeconds ||
      !Number.isInteger(payload.iat) ||
      payload.iat > nowSeconds + 30
    ) {
      throw unauthorized();
    }

    return payload;
  } catch {
    throw unauthorized();
  }
}

export function createSessionService({
  sessionModel,
  userModel,
  authSecret,
  clock = () => new Date(),
  createToken = generateOpaqueToken,
}) {
  const accessKey = deriveKey(authSecret, 'customer-access-token-v1');
  const refreshKey = deriveKey(authSecret, 'customer-refresh-token-v1');

  function makeAccessToken(user, sessionId, now) {
    const issuedAt = Math.floor(now.getTime() / 1000);
    return signAccessToken(
      {
        sub: String(user._id ?? user.id),
        sid: String(sessionId),
        role: user.role,
        iat: issuedAt,
        exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
      },
      accessKey,
    );
  }

  function tokenResponse(user, sessionId, refreshToken, now) {
    return {
      accessToken: makeAccessToken(user, sessionId, now),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshExpiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    };
  }

  return {
    async createSession(user) {
      const now = clock();
      const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
      const session = new sessionModel({
        userId: user._id ?? user.id,
        role: user.role,
        refreshTokenHash: 'pending',
        expiresAt,
      });
      const sessionId = String(session._id ?? session.id);
      const refreshToken = `${sessionId}.${createToken()}`;

      session.refreshTokenHash = hashRefreshToken(refreshKey, refreshToken);
      await session.save();

      return tokenResponse(user, sessionId, refreshToken, now);
    },

    async refresh(refreshToken) {
      const match = sessionIdPattern.exec(refreshToken ?? '');

      if (!match) {
        throw unauthorized();
      }

      const sessionId = match[1];
      const now = clock();
      const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
      const nextRefreshToken = `${sessionId}.${createToken()}`;
      const currentHash = hashRefreshToken(refreshKey, refreshToken);
      const nextHash = hashRefreshToken(refreshKey, nextRefreshToken);
      const session = await sessionModel.findOneAndUpdate(
        {
          _id: sessionId,
          refreshTokenHash: currentHash,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            refreshTokenHash: nextHash,
            lastUsedAt: now,
            expiresAt,
          },
        },
        { new: true },
      );

      if (!session) {
        await sessionModel.updateOne(
          { _id: sessionId, revokedAt: null },
          { $set: { revokedAt: now } },
        );
        throw unauthorized();
      }

      const user = await userModel.findOne({
        _id: session.userId,
        role: session.role,
        isActive: true,
      });

      if (!user) {
        await sessionModel.updateOne(
          { _id: sessionId, revokedAt: null },
          { $set: { revokedAt: now } },
        );
        throw unauthorized();
      }

      return tokenResponse(user, sessionId, nextRefreshToken, now);
    },

    async revoke(sessionId, userId) {
      await sessionModel.updateOne(
        { _id: sessionId, userId, revokedAt: null },
        { $set: { revokedAt: clock() } },
      );
    },

    async authenticateAccessToken(token) {
      const now = clock();
      const payload = verifyAccessToken(token, accessKey, now);
      const sessionIsActive = await sessionModel.exists({
        _id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: now },
      });

      if (!sessionIsActive) {
        throw unauthorized();
      }

      const user = await userModel.findOne({
        _id: payload.sub,
        role: payload.role,
        isActive: true,
      });

      if (!user) {
        throw unauthorized();
      }

      return { user, sessionId: payload.sid };
    },
  };
}

export const sessionPolicy = Object.freeze({
  accessTokenTtlSeconds: ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlMs: REFRESH_TOKEN_TTL_MS,
});
