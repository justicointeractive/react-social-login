import sdks from './sdk';
import { SDKImplementation } from './types';

export type SDKImplementations = typeof sdks;

export type SDKOptionsType<T> = T extends SDKImplementation<infer TOps>
  ? TOps
  : never;

const providerLoad = new Map<keyof SDKImplementations, Promise<void>>();

export async function socialLogin<K extends keyof SDKImplementations>(
  provider: K,
  options: SDKOptionsType<SDKImplementations[K]>
) {
  const sdk = await loadProviderOnce<K>(provider, options);
  const result = await sdk.login(options as any);
  return sdk.generateUser(result);
}

export async function socialLogout<K extends keyof SDKImplementations>(
  provider: K,
  options: SDKOptionsType<SDKImplementations[K]>
) {
  const sdk = await loadProviderOnce<K>(provider, options);
  await sdk.logout();
}

export async function loadProviderOnce<K extends keyof SDKImplementations>(
  provider: K,
  options: SDKOptionsType<SDKImplementations[K]>
) {
  const sdk = sdks[provider];
  const loadPromise = providerLoad.get(provider) ?? sdk.load(options as any);
  providerLoad.set(provider, loadPromise);
  await loadPromise;
  return sdk;
}
