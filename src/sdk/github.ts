import invariant from 'tiny-invariant';
import { v5 as uuid } from 'uuid';
import { rslError } from '../rslError';
import {
  SDKCheckLogin,
  SDKGenerateUser,
  SDKImplementation,
  SDKLoader,
  SDKLogin,
  SDKLogout,
} from '../types';
import { getQueryStringValue } from '../utils';

const GITHUB_API = 'https://api.github.com/graphql';

let oauth = false;
let gatekeeperURL: string | null = null;
let githubAccessToken: string | null = null;
let githubAppId: string | null = null;
let githubAuth: string | null = null;

// Load fetch polyfill for browsers not supporting fetch API
if (typeof window !== 'undefined' && !window.fetch) {
  require('whatwg-fetch');
}

/**
 * Fake Github SDK loading (needed to trick RSL into thinking its loaded).
 */
const load: SDKLoader<GithubSDKOptions> = ({
  appId,
  gatekeeper,
  redirect,
  scope,
}) =>
  new Promise((resolve, reject) => {
    if (!appId) {
      return reject(
        rslError({
          provider: 'github',
          type: 'load',
          description: 'Cannot load SDK without appId',
          error: null,
        })
      );
    }

    githubAppId = appId;

    if (gatekeeper) {
      gatekeeperURL = gatekeeper;
      oauth = true;

      const _redirect = new URL(redirect);
      const searchParams = 'rslCallback=github';
      let githubScopes = ['user'];

      if (Array.isArray(scope)) {
        githubScopes = scope;
      }

      const githubScopesStr = githubScopes
        .reduce((acc, item) => {
          if (typeof item === 'string' && acc.indexOf(item) === -1) {
            acc.push(item.trim());
          }

          return acc;
        }, [] as string[])
        .join('%20');

      _redirect.search = _redirect.search
        ? _redirect.search + '&' + searchParams
        : '?' + searchParams;

      githubAuth = `https://github.com/login/oauth/authorize?client_id=${githubAppId}&redirect_uri=${encodeURIComponent(
        _redirect.toString()
      )}&scope=${githubScopes}&state=${uuid(redirect, uuid.URL)}`;

      if (getQueryStringValue('rslCallback') === 'github') {
        getAccessToken()
          .then((accessToken) => {
            githubAccessToken = accessToken;

            return resolve();
          })
          .catch(reject);
      } else {
        return resolve();
      }
    } else {
      return resolve();
    }
  });

/**
 * Check if user is logged in to app through GitHub.
 * @see https://developer.github.com/apps/building-integrations/setting-up-and-registering-oauth-apps/about-authorization-options-for-oauth-apps/#redirect-urls
 */
const checkLogin: SDKCheckLogin<GithubSDKOptions> = (opts) => {
  if (opts.autoLogin) {
    return login(opts);
  }

  if (!githubAccessToken && oauth) {
    return Promise.reject(
      rslError({
        provider: 'github',
        type: 'access_token',
        description: 'No access token available',
        error: null,
      })
    );
  }

  return new Promise((resolve, reject) => {
    window
      .fetch(GITHUB_API, {
        method: 'POST',
        headers: new Headers({
          Authorization: `Bearer ${githubAccessToken || githubAppId}`,
        }),
        body: JSON.stringify({
          query: 'query { viewer { login, name, email, avatarUrl, id } }',
        }),
      })
      .then((response) => response.json())
      .then((json) => {
        if (json.message || json.errors) {
          return reject(
            rslError({
              provider: 'github',
              type: 'check_login',
              description: 'Failed to fetch user data',
              error: json,
            })
          );
        }

        return resolve(json);
      })
      .catch(() =>
        reject(
          rslError({
            provider: 'github',
            type: 'check_login',
            description:
              'Failed to fetch user data due to window.fetch() error',
            error: null,
          })
        )
      );
  });
};

/**
 * Trigger GitHub login process.
 * This code only triggers login request, response is handled by a callback handled on SDK load.
 * @see https://developer.github.com/apps/building-integrations/setting-up-and-registering-oauth-apps/about-authorization-options-for-oauth-apps
 */
const login: SDKLogin<GithubSDKOptions> = (opts) =>
  new Promise((resolve, reject) => {
    checkLogin(opts)
      .then((response) => resolve(response))
      .catch((error) => {
        if (!oauth) {
          return reject(error);
        }
        invariant(githubAuth, 'does nto have github auth');
        window.open(githubAuth, '_self');
      });
  });

/**
 * Fake GitHub logout always throwing error.
 */
const logout: SDKLogout = () =>
  new Promise((resolve, reject) =>
    reject(
      rslError({
        provider: 'github',
        type: 'logout',
        description: 'Cannot logout from github provider',
        error: null,
      })
    )
  );

/**
 * Get access token with authorization code
 * @see https://github.com/prose/gatekeeper
 * @see https://developer.github.com/apps/building-integrations/setting-up-and-registering-oauth-apps/about-authorization-options-for-oauth-apps
 */
const getAccessToken = () =>
  new Promise<string>((resolve, reject) => {
    const authorizationCode = getQueryStringValue('code');

    if (!authorizationCode) {
      return reject(new Error('Authorization code not found'));
    }

    window
      .fetch(`${gatekeeperURL}/authenticate/${authorizationCode}`)
      .then((response) => response.json())
      .then((json) => {
        if (json.error || !json.token) {
          return reject(
            rslError({
              provider: 'github',
              type: 'access_token',
              description: 'Got error from fetch access token',
              error: json,
            })
          );
        }

        return resolve(json.token as string);
      })
      .catch((error) =>
        reject(
          rslError({
            provider: 'github',
            type: 'access_token',
            description:
              'Failed to fetch user data due to window.fetch() error',
            error,
          })
        )
      );
  });

/**
 * Helper to generate user account data.
 * @param {Object} viewer
 * @see About token expiration: https://gist.github.com/technoweenie/419219#gistcomment-3232
 */
const generateUser: SDKGenerateUser = ({ data: { viewer } }) => {
  const accessToken = githubAccessToken || githubAppId;
  invariant(accessToken, 'did not get access token');
  return {
    profile: {
      id: viewer.id,
      name: viewer.login,
      firstName: viewer.name,
      lastName: viewer.name,
      email: viewer.email,
      profilePicURL: viewer.avatarUrl,
    },
    token: {
      accessToken: accessToken,
      expiresAt: Infinity,
    },
  };
};

type GithubSDKOptions = {
  appId: string;
  autoLogin: boolean;
  gatekeeper: string;
  redirect: string;
  scope: string[];
};

const sdk: SDKImplementation<GithubSDKOptions> = {
  checkLogin,
  generateUser,
  load,
  login,
  logout,
};
export default sdk;
