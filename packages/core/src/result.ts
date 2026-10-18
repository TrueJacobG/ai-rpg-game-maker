export type Result<Data, Error> =
  | { status: 'success'; data: Data }
  | { status: 'error'; error: Error };

export const success = <Data>(data: Data): Result<Data, never> => ({ status: 'success', data });

export const failure = <Error>(error: Error): Result<never, Error> => ({ status: 'error', error });
