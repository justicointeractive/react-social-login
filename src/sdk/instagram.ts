import fetchJsonp from 'fetch-jsonp';
import invariant from 'tiny-invariant';
import { rslError } from '../rslError';
import {
  SDKCheckLogin,
  SDKGenerateUser,
  SDKImplementation,
  SDKLoader,
  SDKLogin,
  SDKLogout,
} from '../types';
import { getHashValue, getQueryStringValue } from '../utils';

const INSTAGRAM_API = 'https://api.instagram.com/v1';

let instagramAuth: string | null = null;
let instagramAccessToken: string | null = null;

/**
 * @param {string} appId
 * @param {string} redirect
 * @param {array|string} scope
 * Fake Instagram SDK loading (needed to trick RSL into thinking its loaded).
 */
const load: SDKLoader<InstagramSDKOptions> = ({ appId, redirect, scope }) =>
  new Promise((resolve, reject) => {
    invariant(redirect, 'redirect url required');
    const _redirect = new URL(redirect);
    const searchParams = 'rslCallback=instagram';

    let instagramScopes = ['user_profile'];
    if (Array.isArray(scope)) {
      instagramScopes = instagramScopes.concat(scope);
    }

    const instagramScopesStr = instagramScopes
      .reduce((acc, item) => {
        if (typeof item === 'string' && acc.indexOf(item) === -1) {
          acc.push(item.trim());
        }

        return acc;
      }, [] as string[])
      .join('+');

    _redirect.search = _redirect.search
      ? _redirect.search + '&' + searchParams
      : '?' + searchParams;

    instagramAuth = `https://api.instagram.com/oauth/authorize/?client_id=${appId}&scope=${instagramScopesStr}&redirect_uri=${encodeURIComponent(
      _redirect.toString()
    )}&response_type=code`;

    if (getQueryStringValue('rslCallback') === 'instagram') {
      if (getQueryStringValue('error')) {
        return reject(
          rslError({
            provider: 'instagram',
            type: 'auth',
            description: 'Authentication failed',
            error: {
              error_reason: getQueryStringValue('error_reason'),
              error_description: getQueryStringValue('error_description'),
            },
          })
        );
      } else {
        instagramAccessToken = getHashValue('access_token');
        invariant(instagramAccessToken, `didn't acquire access token`);
        return resolve();
      }
    }
  });

/**
 * Checks if user is logged in to app through Instagram.
 * @see https://www.instagram.com/developer/endpoints/users/#get_users_self
 */
const checkLogin: SDKCheckLogin<InstagramSDKOptions> = (opts) => {
  if (opts.autoLogin) {
    return login(opts);
  }

  if (!instagramAccessToken) {
    return Promise.reject(
      rslError({
        provider: 'instagram',
        type: 'access_token',
        description: 'No access token available',
        error: null,
      })
    );
  }

  return new Promise((resolve, reject) => {
    fetchJsonp(
      `${INSTAGRAM_API}/users/self/?access_token=${instagramAccessToken}`
    )
      .then((response) => response.json())
      .then((json) => {
        if (json.meta.code !== 200) {
          return reject(
            rslError({
              provider: 'instagram',
              type: 'check_login',
              description: 'Failed to fetch user data',
              error: json.meta,
            })
          );
        }

        return resolve({ data: json.data, accessToken: instagramAccessToken });
      })
      .catch((err) =>
        reject({
          // eslint-disable-line prefer-promise-reject-errors
          fetchErr: true,
          err: rslError({
            provider: 'instagram',
            type: 'check_login',
            description: 'Failed to fetch user data due to fetch error',
            error: err,
          }),
        })
      );
  });
};

/**
 * Trigger Instagram login process.
 * This code only triggers login request, response is handled by a callback handled on SDK load.
 * @see https://www.instagram.com/developer/authentication/
 */
const login: SDKLogin<InstagramSDKOptions> = (opts) =>
  new Promise((resolve, reject) => {
    checkLogin(opts)
      .then((response) => resolve(response))
      .catch((err) => {
        if (!err.fetchErr) {
          invariant(instagramAuth, 'call load before calling login');
          window.open(instagramAuth, '_self');
        } else {
          return reject(err.err);
        }
      });
  });

/**
 * Fake Instagram logout.
 */
const logout: SDKLogout = () =>
  new Promise((resolve) => {
    instagramAccessToken = null;

    return resolve();
  });

/**
 * Helper to generate user account data.
 * @param {Object} data
 * @see About token expiration: https://www.instagram.com/developer/authentication/
 * @see Instagram API doesn’t provide email: https://www.instagram.com/developer/endpoints/users/#get_users_self
 */
const generateUser: SDKGenerateUser = (data) => ({
  profile: {
    id: data.data.id,
    name: data.data.full_name,
    firstName: data.data.full_name,
    lastName: data.data.full_name,
    email: undefined,
    profilePicURL: data.data.profile_picture,
  },
  token: {
    accessToken: data.accessToken,
    expiresAt: Infinity,
  },
});

type InstagramSDKOptions = {
  appId: string;
  autoLogin: boolean;
  redirect: string;
  scope: string[];
};

const sdk: SDKImplementation<InstagramSDKOptions> = {
  checkLogin,
  generateUser,
  load,
  login,
  logout,
};
export default sdk;
