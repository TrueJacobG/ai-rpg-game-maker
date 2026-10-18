import type { Pairing, PrompterDevice } from '@ai-rpg/core/api';
import { useCallback, useEffect, useState } from 'react';
import { type ApiError, createPairing, listDevices, revokeDevice } from './api';

const messageFor = (error: ApiError): string =>
  error.code === 'unauthorized'
    ? 'Your session expired, log in again.'
    : 'Something went wrong. Try again.';

export const TabletPanel = () => {
  const [devices, setDevices] = useState<PrompterDevice[] | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await listDevices();
    if (result.status === 'error') return setError(messageFor(result.error));
    setError(null);
    setDevices(result.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pair = async () => {
    const result = await createPairing();
    if (result.status === 'error') return setError(messageFor(result.error));
    setError(null);
    setPairing(result.data);
  };

  const revoke = async (id: string) => {
    const result = await revokeDevice(id);
    if (result.status === 'error') return setError(messageFor(result.error));
    refresh();
  };

  return (
    <section className="panel">
      <h2>Tablet</h2>
      {error && (
        <p className="error" data-testid="tablet-error">
          {error}
        </p>
      )}
      <button type="button" data-testid="pairing-create" onClick={pair}>
        Pair a tablet
      </button>
      {pairing && (
        <div className="pairing">
          <p className="pairing-code" data-testid="pairing-code">
            {pairing.code}
          </p>
          <p data-testid="pairing-expiry">Enter it on the tablet at /prompter within 10 minutes.</p>
        </div>
      )}
      {devices?.length === 0 && <p data-testid="devices-empty">No tablet is paired.</p>}
      <ul className="device-list">
        {devices?.map((device) => (
          <li key={device.id} data-testid={`device-${device.id}`}>
            Paired {device.createdAt.slice(0, 16).replace('T', ' ')}
            <button
              type="button"
              data-testid={`revoke-${device.id}`}
              onClick={() => revoke(device.id)}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
