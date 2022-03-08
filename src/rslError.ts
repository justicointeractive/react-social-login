export function rslError(arg: RslError): RslError {
  return arg;
}

export type RslError = {
  provider: string;
  type: string;
  description: string;
  error: any;
};
