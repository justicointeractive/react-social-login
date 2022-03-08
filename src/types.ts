export type SDKOptions = {
  appId: string;
  gatekeeper?: string;
  redirect?: string;
  scope?: string[];
  autoLogin?: boolean;
};

export type SDKLoader<T extends SDKOptions> = (options: T) => Promise<void>;

export type SDKUser = {
  profile: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email?: string;
    profilePicURL?: string;
  };
  token: { accessToken: string; expiresAt: number };
};

export type SDKGenerateUser = (data: any) => SDKUser;

export type SDKCheckLogin<T> = (opts: T) => Promise<any>;

export type SDKLogin<T> = (opts: T) => Promise<any>;

export type SDKLogout = () => Promise<void>;

export type SDKImplementation<T extends SDKOptions> = {
  checkLogin: SDKCheckLogin<T>;
  load: SDKLoader<T>;
  login: SDKLogin<T>;
  generateUser: SDKGenerateUser;
  logout: SDKLogout;
};
