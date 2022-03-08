export const timestampFromNow = (durationSeconds: number) => {
  const expiresAt = new Date();
  return expiresAt.setSeconds(expiresAt.getSeconds() + durationSeconds);
};

/**
 * Get key value from url query strings
 * @param {string} key Key to get value from
 * @returns {string}
 */
export const getQueryStringValue = (key: string) => {
  return decodeURIComponent(
    window.location.search.replace(
      new RegExp(
        '^(?:.*[&\\?]' +
          encodeURIComponent(key).replace(/[.+*]/g, '\\$&') +
          '(?:\\=([^&]*))?)?.*$',
        'i'
      ),
      '$1'
    )
  );
};

/**
 * Get key value from location hash
 * @param {string} key Key to get value from
 * @returns {string|null}
 */
export const getHashValue = (key: string) => {
  const matches = window.location.hash.match(new RegExp(`${key}=([^&]*)`));

  return matches ? matches[1] : null;
};
