import { rslError } from '../rslError';
import {
  SDKGenerateUser,
  SDKImplementation,
  SDKLoader,
  SDKLogin,
  SDKLogout,
} from '../types';

declare global {
  interface Window {
    gapi: {
      load: (...args: any[]) => any;
      auth2: {
        getAuthInstance: (...args: any[]) => any;
        init: (...args: any[]) => any;
      };
    };
  }
}

/**
 * Loads Google SDK.
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiclientloadname--------version--------callback
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiauth2initparams
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiauth2getauthinstance
 */
const load: SDKLoader<GoogleSDKOptions> = ({ appId, scope }) =>
  new Promise((resolve, reject) => {
    const firstJS = document.getElementsByTagName('script')[0];
    const js = document.createElement('script');

    js.src = 'https://apis.google.com/js/api.js';
    js.id = 'gapi-client';

    js.onload = () => {
      window.gapi.load('auth2', () => {
        if (!window.gapi.auth2.getAuthInstance()) {
          window.gapi.auth2
            .init({
              client_id: appId,
              fetchBasicProfile: true,
              scope: scope.join(' '),
            })
            .then(
              () => resolve(),
              (err: unknown) =>
                reject(
                  rslError({
                    provider: 'google',
                    type: 'load',
                    description: 'Failed to load SDK',
                    error: err,
                  })
                )
            );
        } else {
          resolve();
        }
      });
    };

    if (!firstJS) {
      document.appendChild(js);
    } else {
      firstJS.parentNode!.appendChild(js);
    }
  });

/**
 * Checks if user is logged in to app through Google.
 * Requires SDK to be loaded first.
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiauth2getauthinstance
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#googleauthissignedinget
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#googleauthcurrentuserget
 */
const checkLogin = () =>
  new Promise((resolve, reject) => {
    const GoogleAuth = window.gapi.auth2.getAuthInstance();

    if (!GoogleAuth.isSignedIn.get()) {
      return reject(
        rslError({
          provider: 'google',
          type: 'check_login',
          description: 'Not authenticated',
          error: null,
        })
      );
    }

    return resolve(GoogleAuth.currentUser.get());
  });

/**
 * Trigger Google login process.
 * Requires SDK to be loaded first.
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiauth2getauthinstance
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#googleauthsignin
 */
const login: SDKLogin<GoogleSDKOptions> = (opts) =>
  new Promise((resolve, reject) => {
    const GoogleAuth = window.gapi.auth2.getAuthInstance();

    GoogleAuth.signIn().then(
      () => checkLogin().then(resolve, reject),
      (err: unknown) =>
        reject(
          rslError({
            provider: 'google',
            type: 'auth',
            description: 'Authentication failed',
            error: err,
          })
        )
    );
  });

/**
 * Trigger Google logout.
 * Requires SDK to be loaded first.
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#googleauthsignout
 */
const logout: SDKLogout = () =>
  new Promise((resolve, reject) => {
    const GoogleAuth = window.gapi.auth2.getAuthInstance();

    GoogleAuth.signOut().then(resolve, reject);
  });

/**
 * Helper to generate user account data.
 * @param {Object} response
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#googleusergetbasicprofile
 * @see https://developers.google.com/api-client-library/javascript/reference/referencedocs#googleusergetauthresponseincludeauthorizationdata
 */
const generateUser: SDKGenerateUser = (response) => {
  var gender = '';
  const profile = response.getBasicProfile();
  const authResponse = response.getAuthResponse(true);

  // Need to get gender if defined within scope
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open(
    'GET',
    'https://www.googleapis.com/oauth2/v1/userinfo?access_token=' +
      authResponse.access_token,
    false
  );
  xmlHttp.send(null);
  if (xmlHttp.status === 200) {
    var strJSON = xmlHttp.responseText;
    var objJSON = JSON.parse(strJSON);
    gender = objJSON.gender;
  }

  return {
    profile: {
      id: profile.getId(),
      name: profile.getName(),
      firstName: profile.getGivenName(),
      lastName: profile.getFamilyName(),
      email: profile.getEmail(),
      profilePicURL: profile.getImageUrl(),
      gender: gender,
    },
    token: {
      accessToken: authResponse.access_token,
      idToken: authResponse.id_token,
      scope: authResponse.scope,
      expiresIn: authResponse.expires_in,
      firstIssued_at: authResponse.first_issued_at,
      expiresAt: authResponse.expires_at,
    },
  };
};

type GoogleSDKOptions = { appId: string; scope?: string[] };

const sdk: SDKImplementation<GoogleSDKOptions> = {
  checkLogin,
  generateUser,
  load,
  login,
  logout,
};
export default sdk;
