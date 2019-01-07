const path = require('path');
const initCACCL = require('caccl/script');

const codes = {};
const REFRESH_TOKEN = 'dskfur392nbfassfdlkjanseflkjsdfow';

const genCode = () => {
  const nextCode = new Date().getTime();
  codes[nextCode] = true;
  return nextCode;
};

const clientId = 'client_id';
const clientSecret = 'client_secret';

module.exports = (app, canvasHost, accessToken) => {
  // Get information on the current user
  let user;
  const api = initCACCL({
    canvasHost,
    accessToken,
  });
  api.user.self.getProfile()
    .then((profile) => {
      user = profile;
    })
    .catch(() => {
      user = {};
    });

  // Add token expiry countdown
  let tokenExpiry;
  const tokenIsValid = () => {
    if (!tokenExpiry) {
      return false;
    }
    return tokenExpiry > new Date().getTime();
  };
  const resetTokenExpiry = () => {
    tokenExpiry = new Date().getTime() + 3600000;
  };

  app.get('/login/oauth2/auth', (req, res) => {
    const { state } = req.query;
    const redirectURI = req.query.redirect_uri;

    // Detect and complain about unknown clients
    if (clientId !== req.query.client_id) {
      return res.send('while(1);{"error":"invalid_client","error_description":"unknown client"}');
    }

    // Detect and complain about invalid redirectURI
    if (!redirectURI.startsWith('https://localhost')) {
      return res.send('while(1);{"error":"invalid_request","error_description":"redirect_uri does not match client settings"}');
    }

    // Detect and complain about invalid code
    if (req.query.response_type !== 'code') {
      return res.redirect(`${redirectURI}?error=unsupported_response_type&error_description=Only+response_type%3Dcode+is+permitted`);
    }

    // Generate a code
    const code = genCode();

    // Show authorize page
    res.render(path.join(__dirname, 'authorizePage.ejs'), {
      user,
      cancelURL: `${redirectURI}?error=access_denied`,
      authorizeURL: `${redirectURI}?code=${code}&state=${state}`,
    });
  });

  app.post('/login/oauth2/token', (req, res) => {
    // Handle code-based authorization request
    if (req.body.grant_type === 'authorization_code') {
      if (clientId !== req.body.client_id) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'unknown client',
        });
      }
      if (clientSecret !== req.body.client_secret) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'invalid client',
        });
      }
      if (!codes[req.body.code]) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'authorization_code not found',
        });
      }
      delete codes[req.body.code];

      resetTokenExpiry();
      return res.json({
        access_token: accessToken,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        token_type: 'Bearer',
        user:
          {
            id: user.id,
            name: user.name,
            global_id: null,
            effective_locale: 'en',
          },
      });
    }

    // Handle refresh token request
    if (req.body.grant_type === 'refresh_token') {
      if (clientId !== req.body.client_id) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'unknown client',
        });
      }
      if (clientSecret !== req.body.client_secret) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'invalid client',
        });
      }
      if (req.body.refresh_token !== REFRESH_TOKEN) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'authorization_code not found',
        });
      }

      resetTokenExpiry();
      return res.json({
        access_token: accessToken,
        expires_in: 3600,
        token_type: 'Bearer',
        user:
          {
            id: user.id,
            name: user.name,
            global_id: null,
            effective_locale: 'en',
          },
      });
    }

    // Must be an invalid grant type
    return res.status(500).send('Invalid grant type');
  });

  // Simulate process of token expiring
  app.all('*', (req, res, next) => {
    if (req.body.access_token && !tokenIsValid()) {
      req.body.access_token = 'invalid_access_token';
    }
    next();
  });
};
