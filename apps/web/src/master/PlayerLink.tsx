import { useState } from 'react';
import { QrCode } from './QrCode';

type PlayerLinkProps = { name: string; token: string; onRegenerate: () => void };

export const PlayerLink = ({ name, token, onRegenerate }: PlayerLinkProps) => {
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');
  const url = `${window.location.origin}/p/${token}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopy('done');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <div className="player-link">
      <QrCode text={url} label={`Player link for ${name}`} />
      <p className="url" data-testid="player-url">
        {url}
      </p>
      <div className="row">
        <button type="button" data-testid="copy-link" onClick={copyLink}>
          Copy link
        </button>
        <button type="button" data-testid="regenerate-token" onClick={onRegenerate}>
          New QR code
        </button>
        {copy === 'done' && <span>Copied</span>}
        {copy === 'failed' && <span>Copy failed</span>}
      </div>
    </div>
  );
};
