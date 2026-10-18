import { randomBytes } from 'node:crypto';

export const passphraseProblem = (passphrase, confirmation) => {
  if (passphrase.length < 12) return 'Use at least 12 characters.';
  if (passphrase !== confirmation) return 'The two entries do not match.';
  return null;
};

export const newSessionSecret = () => randomBytes(36).toString('base64');
