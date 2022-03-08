import { rslError } from '../rslError';
import {
  SDKCheckLogin,
  SDKGenerateUser,
  SDKImplementation,
  SDKLoader,
  SDKLogin,
  SDKLogout,
} from '../types';
import { timestampFromNow } from '../utils';

declare global {
  interface Window {
    onAmazonLoginReady: () => void;
    amazon: {
      Login: {
        setClientId: (...args: any[]) => any;
        authorize: (...args: any[]) => any;
        logout: (...args: any[]) => any;
        retrieveProfile: (...args: any[]) => any;
      };
    };
  }
}

/**
 * Loads Amazon SDK.
 * @param {string} appId
 * @param {array|string} scope
 * @see https://developer.amazon.com/public/apis/engage/login-with-amazon/docs/install_sdk_javascript.html
 */
const load: SDKLoader<{ scope: string[] }> = ({ appId, scope }) =>
  new Promise((resolve) => {
    // @TODO: handle errors
    if (document.getElementById('amazon-sdk')) {
      return resolve();
    }

    const firstJS = document.getElementsByTagName('script')[0];
    const js = document.createElement('script');

    js.src = 'https://api-cdn.amazon.com/sdk/login1.js';
    js.id = 'amazon-sdk';
    js.async = true;

    window.onAmazonLoginReady = () => {
      window.amazon.Login.setClientId(appId);

      return resolve();
    };

    if (!firstJS) {
      document.appendChild(js);
    } else {
      firstJS.parentNode!.appendChild(js);
    }
  });

/**
 * Checks if user is logged in to app through Amazon.
 * Requires SDK to be loaded first.
 * @see https://developer.amazon.com/public/apis/engage/login-with-amazon/docs/javascript_sdk_reference.html#authorize
 */
const checkLogin: SDKCheckLogin<AmazonSDKOptions> = (opts) =>
  new Promise((resolve, reject) => {
    let amazonScopes = ['profile'];
    if (Array.isArray(opts.scope)) {
      amazonScopes = amazonScopes.concat(opts.scope);
    }

    const amazonScopesStr = amazonScopes.reduce((acc, item) => {
      if (typeof item === 'string' && acc.indexOf(item) === -1) {
        acc.push(item.trim());
      }

      return acc;
    }, [] as string[]);

    window.amazon.Login.authorize(
      { scope: amazonScopesStr },
      (response: any) => {
        if (response.error) {
          return reject(
            rslError({
              provider: 'amazon',
              type: 'auth',
              description: 'Authentication failed',
              error: response,
            })
          );
        }

        return getProfile(response).then(resolve, reject);
      }
    );
  });

/**
 * Trigger Amazon login process.
 * Requires SDK to be loaded first.
 */
const login: SDKLogin<AmazonSDKOptions> = (opts) =>
  new Promise((resolve, reject) => {
    return checkLogin(opts).then(resolve, reject);
  });

/**
 * Trigger Amazon logout.
 * Requires SDK to be loaded first.
 * @see https://developer.amazon.com/docs/login-with-amazon/javascript-sdk-reference.html#logout
 */
const logout: SDKLogout = () =>
  new Promise((resolve) => {
    window.amazon.Login.logout();

    return resolve();
  });

/**
 * Gets currently logged in user profile data.
 * Requires SDK to be loaded first.
 * @see https://developer.amazon.com/public/apis/engage/login-with-amazon/docs/javascript_sdk_reference.html#retrieveProfile
 */
const getProfile = (authResponse: any) =>
  new Promise((resolve, reject) => {
    window.amazon.Login.retrieveProfile(
      authResponse.access_token,
      (response: any) => {
        if (response.error) {
          return reject(
            rslError({
              provider: 'amazon',
              type: 'get_profile',
              description: 'Failed to get user profile',
              error: response,
            })
          );
        }

        return resolve({ ...authResponse, ...response });
      }
    );
  });

/**
 * Helper to generate user account data.
 * @param {Object} response
 * @see https://developer.amazon.com/public/apis/engage/login-with-amazon/docs/javascript_sdk_reference.html#retrieveProfile
 */
const generateUser: SDKGenerateUser = (response) => ({
  profile: {
    id: response.profile.CustomerId,
    name: response.profile.Name,
    firstName: response.profile.Name,
    lastName: response.profile.Name,
    email: response.profile.PrimaryEmail,
    profilePicURL: undefined, // No profile picture available for Amazon provider
  },
  token: {
    accessToken: response.access_token,
    expiresAt: timestampFromNow(response.expires_in),
  },
});

type AmazonSDKOptions = {
  appId: string;
  scope: string[];
};

const sdk: SDKImplementation<AmazonSDKOptions> = {
  checkLogin,
  generateUser,
  load,
  login,
  logout,
};
export default sdk;
