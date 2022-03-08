import sdks from './sdk';
import { SDKImplementation } from './types';

type SDKImplementations = typeof sdks;

type SDKOptionsType<T> = T extends SDKImplementation<infer TOps> ? TOps : never;

export async function socialLogin<
  T extends SDKImplementations,
  K extends keyof SDKImplementations
>(provider: K, options: SDKOptionsType<T[K]>) {
  const sdk = sdks[provider];
  await sdk.load(options as any);
  const result = await sdk.login(options as any);
  return sdk.generateUser(result);
}

export async function socialLogout<
  T extends SDKImplementations,
  K extends keyof SDKImplementations
>(provider: K, options: SDKOptionsType<T[K]>) {
  const sdk = sdks[provider];
  await sdk.load(options as any);
  await sdk.logout();
}
