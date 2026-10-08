const crypto = require("crypto");
const db = require("../../infra/firestore");
const config = require("../../config");
const { default: axios } = require("axios");

const STATE_COLLECTION = "oauth_state";
const STATE_DOC = "sapo";

function createOAuthState() {
  return crypto.randomBytes(32).toString("hex");
}

async function createAuthorizeUrl() {
  const { clientId, redirectUri, scope, authorizeUrl, tenantId, tenantName } =
    config.sapoInvoice;

  if (!clientId) {
    throw new Error("Missing Sapo Invoice client id");
  }

  if (!redirectUri) {
    throw new Error("Missing redirect uri");
  }

  if (!authorizeUrl) {
    throw new Error("Missing authorize url");
  }

  const state = createOAuthState();
  await db
    .collection(STATE_COLLECTION)
    .doc(STATE_DOC)
    .set({
      state: state,
      connectedTenantId: tenantId,

      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

  const params = new URLSearchParams();

  params.set("client_id", clientId);

  params.set("scope", scope);

  params.set("redirect_uri", redirectUri);

  params.set("connected_tenant_id", tenantId);

  params.set("connected_tenant_name", tenantName);

  params.set("state", state);

  const url = `${authorizeUrl}?${params.toString()}`;

  console.log("[OAUTH AUTHORIZE PARAMS]", {
    hasClientId: Boolean(clientId),

    scope,

    redirectUri,

    connectedTenantId: tenantId,

    connectedTenantName: tenantName || null,

    hasState: Boolean(state),
  });

  return {
    authorizeUrl: url,
    state,
  };
}

async function validateState(state) {
  if (!state) {
    throw new Error("Missing OAuth state");
  }
  const ref = db.collection(STATE_COLLECTION).doc(STATE_DOC);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error("Invalid OAuth state");
  }

  const data = doc.data();
  if (!data.state || data.state !== state) {
    throw new Error("OAuth state mismatch");
  }
  if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
    await ref.delete();
    throw new Error("OAuth state expired");
  }
  await ref.delete();
  return true;
}

function verifyHmac(query) {
  const usp = new URLSearchParams();
  Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "state")
    .sort()
    .forEach((key) => usp.append(key, query[key]));
  const baseString = usp.toString();

  const expected = crypto
    .createHmac("sha256", config.sapoInvoice.clientSecret)
    .update(baseString)
    .digest("base64");
  const received = decodeURIComponent(query.hmac);

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function validateTimestamp(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) {
    throw new Error("Invalid callback timestamp");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - value) > 300) {
    throw new Error("OAuth callback expired");
  }
  return true;
}

async function exchangeCodeForTokens(code) {
  if (!code) {
    throw new Error("Missing authorization code");
  }

  try {
    const response = await axios.post(
      config.sapoInvoice.tokenUrl,
      {
        token_exchange: {
          client_id: config.sapoInvoice.clientId,

          client_secret: config.sapoInvoice.clientSecret,

          code,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",

          Accept: "application/json",
        },
      },
    );

    return response.data.token_exchange;
  } catch (error) {
    console.error("[TOKEN EXCHANGE ERROR]", {
      status: error.response?.status,

      data: error.response?.data,

      message: error.message,
    });

    const err = new Error(
      `Sapo token exchange failed: ${
        JSON.stringify(error.response?.data) || error.message
      }`,
    );

    err.status = error.response?.status || 500;

    throw err;
  }
}


// async function refreshAccessToken(
//   refreshToken,
//   connectedTenantId
// ) {
//   if (!refreshToken) {
//     throw new Error(
//       "Missing Sapo Invoice refresh token"
//     );
//   }

//   if (!connectedTenantId) {
//     throw new Error(
//       "Missing connected tenant id"
//     );
//   }

//   console.log("[TOKEN REFRESH REQUEST]", {
//     hasRefreshToken:
//       Boolean(refreshToken),

//     connectedTenantId:
//       String(connectedTenantId),
//   });

//   try {
//     const response =
//       await axios.post(
//         config.sapoInvoice.refreshUrl,

//         {
//           token_exchange: {
//             client_id:
//               config.sapoInvoice.clientId,

//             client_secret:
//               config.sapoInvoice.clientSecret,

//             refresh_token:
//               refreshToken,
//           },
//         },

//         {
//           params: {
//             connected_tenant_id:
//               String(
//                 connectedTenantId
//               ),
//           },

//           headers: {
//             "Content-Type":
//               "application/json",

//             Accept:
//               "application/json",
//           },

//           timeout: 15000,
//         }
//       );

//     const tokens =
//       response.data?.token_exchange ??
//       response.data;

//     if (!tokens?.access_token) {
//       throw new Error(
//         "Sapo refresh response missing access_token"
//       );
//     }

//     if (!tokens?.refresh_token) {
//       throw new Error(
//         "Sapo refresh response missing refresh_token"
//       );
//     }

//     console.log(
//       "[TOKEN REFRESH SUCCESS]",
//       {
//         hasAccessToken: true,
//         hasRefreshToken: true,
//         expiresIn:
//           tokens.expires_in,
//       }
//     );

//     return tokens;

//   } catch (error) {
//     console.error(
//       "[TOKEN REFRESH ERROR]",
//       {
//         status:
//           error.response?.status,

//         data:
//           error.response?.data,

//         message:
//           error.message,
//       }
//     );

//     const err =
//       new Error(
//         `Sapo token refresh failed: ${
//           JSON.stringify(
//             error.response?.data
//           ) ||
//           error.message
//         }`
//       );

//     err.status =
//       error.response?.status ||
//       500;

//     throw err;
//   }
// }

async function refreshAccessToken(
  refreshToken
) {
  if (!refreshToken) {
    throw new Error(
      "Missing Sapo Invoice refresh token"
    );
  }

  try {
    const response =
      await axios.post(
        config.sapoInvoice.refreshUrl,
        {
          token_exchange: {
            client_id:
              config.sapoInvoice.clientId,

            client_secret:
              config.sapoInvoice.clientSecret,

            refresh_token:
              refreshToken,
          },
        },
        {
          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          timeout: 15000,
        },
      );

    const tokens =
      response.data?.token_exchange;

    if (!tokens) {
      throw new Error(
        "Sapo refresh response missing token_exchange"
      );
    }

    if (!tokens.access_token) {
      throw new Error(
        "Sapo refresh response missing access_token"
      );
    }

    if (!tokens.refresh_token) {
      throw new Error(
        "Sapo refresh response missing refresh_token"
      );
    }

    console.log(
      "[TOKEN REFRESH SUCCESS]",
      {
        hasAccessToken: true,
        hasRefreshToken: true,
        expiresIn:
          tokens.expires_in,
        scope:
          tokens.scope,
      }
    );

    return tokens;

  } catch (error) {
    console.error(
      "[TOKEN REFRESH ERROR]",
      {
        status:
          error.response?.status,

        data:
          error.response?.data,

        message:
          error.message,
      }
    );

    const err =
      new Error(
        `Sapo token refresh failed: ${
          JSON.stringify(
            error.response?.data
          ) ||
          error.message
        }`
      );

    err.status =
      error.response?.status ||
      500;

    throw err;
  }
}

const oauthService = {
  createAuthorizeUrl,
  validateState,
  validateTimestamp,
  verifyHmac,
  exchangeCodeForTokens,
  refreshAccessToken,
};

module.exports = oauthService;
