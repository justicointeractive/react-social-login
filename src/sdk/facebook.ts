import { rslError } from '../rslError';
import {
  SDKGenerateUser,
  SDKImplementation,
  SDKLoader,
  SDKLogin,
  SDKLogout,
} from '../types';
import { timestampFromNow } from '../utils';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (...args: any[]) => any;
      api: (...args: any[]) => any;
      getLoginStatus: (...args: any[]) => any;
      login: (...args: any[]) => any;
      logout: (...args: any[]) => any;
    };
  }
}

/**
 * Loads Facebook SDK.
 * @param {string} appId
 * @param {array|string} scope
 * @param {array|string} version
 * @see https://developers.facebook.com/docs/javascript/quickstart
 */
const load: SDKLoader<FbSDKOptions> = ({ appId, scope, version }) =>
  new Promise((resolve) => {
    // @TODO: handle errors
    if (document.getElementById('facebook-jssdk')) {
      return resolve();
    }

    const firstJS = document.getElementsByTagName('script')[0];
    const js = document.createElement('script');

    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.id = 'facebook-jssdk';

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        xfbml: true,
        version: version || 'v5.0',
      });

      return resolve();
    };

    if (!firstJS) {
      document.appendChild(js);
    } else {
      firstJS.parentNode!.appendChild(js);
    }
  });

/**
 * Gets Facebook user profile if connected.
 * @param {Object} response
 */
const handleLoginStatus = (response: any) =>
  new Promise((resolve, reject) => {
    if (!response.authResponse) {
      return reject(
        rslError({
          provider: 'facebook',
          type: 'auth',
          description: 'Authentication failed',
          error: response,
        })
      );
    }

    switch (response.status) {
      case 'connected':
        getProfile().then((profile) =>
          resolve({
            ...profile,
            ...response.authResponse,
          })
        );

        break;
      case 'not_authorized':
      case 'unknown':
        return reject(
          rslError({
            provider: 'facebook',
            type: 'auth',
            description:
              'Authentication has been cancelled or an unknown error occurred',
            error: response,
          })
        );
    }
  });

/**
 * Checks if user is logged in to app through Facebook.
 * Requires SDK to be loaded first.
 * @see https://developers.facebook.com/docs/reference/javascript/FB.getLoginStatus/
 */
const checkLogin = () =>
  new Promise((resolve, reject) => {
    window.FB.getLoginStatus((response: any) =>
      handleLoginStatus(response).then(resolve, reject)
    );
  });

/**
 * Trigger Facebook login popup.
 * Requires SDK to be loaded first.
 * @see https://developers.facebook.com/docs/reference/javascript/FB.login/v2.9
 */
const login: SDKLogin<FbSDKOptions> = (opts) => {
  let facebookScopes = ['public_profile', 'email'];

  if (Array.isArray(opts.scope)) {
    facebookScopes = facebookScopes.concat(opts.scope);
  }

  const facebookScopesStr = facebookScopes
    .reduce((acc, item) => {
      if (typeof item === 'string' && acc.indexOf(item) === -1) {
        acc.push(item.trim());
      }

      return acc;
    }, [] as string[])
    .join(',');

  return new Promise((resolve, reject) => {
    window.FB.login(
      (response: any) => handleLoginStatus(response).then(resolve, reject),
      { scope: facebookScopesStr }
    );
  });
};

/**
 * Trigger Facebook logout.
 * Requires SDK to be loaded first.
 * @see https://developers.facebook.com/docs/reference/javascript/FB.logout
 */
const logout: SDKLogout = () =>
  new Promise((resolve) => {
    window.FB.logout(resolve);
  });

/**
 * Gets currently logged in user profile data.
 * Requires SDK to be loaded first.
 * @see https://developers.facebook.com/tools/explorer?method=GET&path=me%3Ffields%3Demail%2Cname%2Cid%2Cfirst_name%2Clast_name%2Cpicture&version=v2.9
 */
const getProfile = () =>
  new Promise<any>((resolve) => {
    window.FB.api(
      '/me',
      'GET',
      {
        fields: 'email,name,id,first_name,last_name,picture',
      },
      resolve
    );
  });

/**
 * Helper to generate user account data.
 * @param {Object} response
 */
const generateUser: SDKGenerateUser = (response) => ({
  profile: {
    id: response.id,
    name: response.name,
    firstName: response.first_name,
    lastName: response.last_name,
    email: response.email,
    profilePicURL: response.picture.data.url,
  },
  token: {
    accessToken: response.accessToken,
    expiresAt: timestampFromNow(response.expiresIn),
  },
});

type FbSDKOptions = { appId: string; scope?: string[]; version?: string };

const sdk: SDKImplementation<FbSDKOptions> = {
  checkLogin,
  generateUser,
  load,
  login,
  logout,
};

export default sdk;
