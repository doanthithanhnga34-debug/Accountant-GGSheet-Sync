const config = require("../../config");
const db = require("../../infra/firestore");
const oauthService = require("./oauth.service");

const COLLECTION = "oauth_token";
const DOCUMENT = "sapo";
let refreshPromise=null;

async function set(tokens) {
   if (!tokens?.access_token) {
      throw new Error("Missing access_token");
    }
  
    if (!tokens?.refresh_token) {
      throw new Error("Missing refresh_token");
    }
  
  const expiresIn = Number(tokens.expires_in);
    if (!Number.isFinite(expiresIn)) {
      throw new Error("Invalid expires_in");
    }
  const data = {
    accessToken: tokens.access_token,

    refreshToken: tokens.refresh_token,

    expiresIn: tokens.expires_in,

    expiresAt: Date.now() + expiresIn * 1000,

    scope: tokens.scope || "",

    issuedAt: tokens.issued_at || "",

    updatedAt: new Date(),
  };
  if (tokens.connectedTenantId) {
    data.connectedTenantId = tokens.connectedTenantId;
  }
  await db.collection(COLLECTION).doc(DOCUMENT).set(data, {
    merge: true,
  });
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
  console.log("token get valid", tokens);
  if (!tokens.accessToken) {
    throw new Error("Missing Sapo Invoice access token");
  }

  const expiresAt = Number(tokens.expiresAt) || 0;
  const refreshBefore = 5 * 60 * 1000;
  const stillValid = expiresAt && Date.now() < expiresAt - refreshBefore;
  if (stillValid) {
    return tokens.accessToken;
  }
  if(refreshPromise){
    return refreshPromise;
  }
  refreshPromise = refreshAndSaveToken(tokens);
  try {
    return await refreshPromise;
  }finally{
    refreshPromise=null
  }
}


// async function  refreshAndSaveToken(currentTokens){
//   const latestTokens = await get();
//   if(!latestTokens){
//     throw new Error("Sapo invoice is not authenticated")
//   }
//   const expiresAt = Number(latestTokens.expiresAt) || 0;
//   const refreshBefore = 5*60*1000;
//   if(expiresAt && Date.now() < expiresAt -refreshBefore){
//     return latestTokens.accessToken
//   }
//   if(!latestTokens.refreshToken){
//     throw new Error("Missing Sapo Invoice refresh token")
//   }
//   const connectedTenantId = latestTokens.connectedTenantId || config.sapoInvoice.tenantId;
//   console.log("Mã đơn vị trong token refresh",connectedTenantId)
//   const newTokens = await oauthService.refreshAccessToken(latestTokens.refreshToken, connectedTenantId);

//   await set({
//     ...newTokens,
//     connectedTenantId,
//   })
//   return newTokens.access_token
// }


async function refreshAndSaveToken() {
  const latestTokens =
    await get();

  if (!latestTokens) {
    throw new Error(
      "Sapo Invoice is not authenticated"
    );
  }

  const expiresAt =
    Number(
      latestTokens.expiresAt
    ) || 0;

  const refreshBefore =
    5 * 60 * 1000;

  if (
    expiresAt &&
    Date.now() <
      expiresAt - refreshBefore
  ) {
    return latestTokens.accessToken;
  }

  if (!latestTokens.refreshToken) {
    throw new Error(
      "Missing Sapo Invoice refresh token"
    );
  }

  console.log(
    "[TOKEN] Refreshing access token"
  );

  const newTokens =
    await oauthService
      .refreshAccessToken(
        latestTokens.refreshToken
      );

  await set({
    ...newTokens,

    connectedTenantId:
      latestTokens.connectedTenantId ||
      config.sapoInvoice.tenantId,
  });

  console.log(
    "[TOKEN] New token pair saved"
  );

  return newTokens.access_token;
}
const tokenService = {
  get,
  set,
  getValidAccessToken,
};
module.exports = tokenService;
