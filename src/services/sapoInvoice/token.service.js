const config = require("../../config");
const db = require("../../infra/firestore");
const oauthService = require("./oauth.service");

const COLLECTION = "oauth_token";
const DOCUMENT = "sapo";

async function set(tokens) {
   const expiresIn =
    Number(tokens.expires_in);
  const data = {
    accessToken: tokens.access_token,

    refreshToken: tokens.refresh_token,

    expiresIn: tokens.expires_in,

    expiredAt: Date.now() + expiresIn * 1000,

    scope: tokens.scope || "",

    issuedAt: tokens.issued_at || "",

    updatedAt: new Date(),
  };
  if (tokens.connectedTenantId) {
    data.connectedTenantId = tokens.connectedTenantId;
  }
  await db
    .collection(COLLECTION)
    .doc(DOCUMENT)
    .set(
     data,
      {
        merge: true,
      },
    );
}

async function get() {
  const doc = await db.collection(COLLECTION).doc(DOCUMENT).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data();
}

async function getValidAccessToken() {
  const tokens = await get();
  if (!tokens) {
    throw new Error("Sapo invoice is not authenticated");
  }
  console.log("token get valid", tokens)
  if (!tokens.accessToken) {
    throw new Error("Missing Sapo Invoice access token");
  }
  const now = Date.now();
  const expiredAt = Number(tokens.expiredAt) || 0;
  const refreshBefore = 5 * 60 * 1000;
  const stillValid = expiredAt && now < expiredAt - refreshBefore;
  if (stillValid) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw new Error("Missing sapo invoice refresh token");
  }
  const newTokens = await oauthService.refreshAccessToken(tokens.refreshToken,config.sapoInvoice.tenantId);

  await set({
    ...newTokens,
  });
  return newTokens.access_token;
}

const tokenService = {
  get,
  set,
  getValidAccessToken,
};
module.exports = tokenService;
