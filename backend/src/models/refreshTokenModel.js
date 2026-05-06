const crypto = require("crypto");
const pool = require("../config/db");

function getDb(db) {
  return db || pool;
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

async function createRefreshTokenRecord({ userId, tokenId, refreshToken, expiresAt }, db) {
  const conn = getDb(db);
  const tokenHash = hashRefreshToken(refreshToken);
  const result = await conn.query(
    `INSERT INTO refresh_tokens (user_id, token_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, token_id, expires_at, revoked_at, replaced_by_token_id, created_at`,
    [userId, tokenId, tokenHash, expiresAt]
  );
  return result.rows[0] || null;
}

async function findRefreshTokenByTokenId(tokenId, db) {
  const conn = getDb(db);
  const result = await conn.query(
    `SELECT id, user_id, token_id, token_hash, expires_at, revoked_at, replaced_by_token_id, created_at
     FROM refresh_tokens
     WHERE token_id = $1
     LIMIT 1`,
    [tokenId]
  );
  return result.rows[0] || null;
}

async function revokeRefreshTokenByTokenId(tokenId, options = {}, db) {
  const conn = getDb(db);
  const replacedByTokenId = String(options.replacedByTokenId || "").trim() || null;
  const result = await conn.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(),
         replaced_by_token_id = COALESCE($2, replaced_by_token_id)
     WHERE token_id = $1
       AND revoked_at IS NULL
     RETURNING id, user_id, token_id`,
    [tokenId, replacedByTokenId]
  );
  return result.rows[0] || null;
}

async function revokeRefreshTokenByRawToken(refreshToken, db) {
  const conn = getDb(db);
  const tokenHash = hashRefreshToken(refreshToken);
  const result = await conn.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL
     RETURNING id, user_id, token_id`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function revokeAllRefreshTokensForUser(userId, db) {
  const conn = getDb(db);
  await conn.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}

async function deleteExpiredRefreshTokens(db) {
  const conn = getDb(db);
  await conn.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at <= NOW()`
  );
}

module.exports = {
  createRefreshTokenRecord,
  deleteExpiredRefreshTokens,
  findRefreshTokenByTokenId,
  hashRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenByRawToken,
  revokeRefreshTokenByTokenId,
};
