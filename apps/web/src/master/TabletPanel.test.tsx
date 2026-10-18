import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { TabletPanel } from './TabletPanel';

const deviceId = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
const device = { id: deviceId, createdAt: '2026-10-18T12:00:00.000Z' };

const serveDevices = (devices: unknown[] = []) =>
  server.use(http.get('/api/master/prompter/devices', () => HttpResponse.json(devices)));

describe('TabletPanel', () => {
  it('lists paired tablets', async () => {
    serveDevices([device]);
    render(<TabletPanel />);
    expect(await screen.findByTestId(`device-${deviceId}`)).toHaveTextContent('2026-10-18');
  });

  it('says when no tablet is paired', async () => {
    serveDevices();
    render(<TabletPanel />);
    expect(await screen.findByTestId('devices-empty')).toBeInTheDocument();
  });

  it('shows a pairing code with its expiry', async () => {
    serveDevices();
    server.use(
      http.post('/api/master/prompter/pairing', () =>
        HttpResponse.json(
          { code: '012345', expiresAt: '2026-10-18T12:10:00.000Z' },
          { status: 201 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<TabletPanel />);

    await user.click(await screen.findByTestId('pairing-create'));

    expect(await screen.findByTestId('pairing-code')).toHaveTextContent('012345');
    expect(screen.getByTestId('pairing-expiry')).toHaveTextContent('10 minutes');
  });

  it('revokes a tablet and refreshes the list', async () => {
    serveDevices([device]);
    const revoke = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete(`/api/master/prompter/devices/${deviceId}`, revoke));
    const user = userEvent.setup();
    render(<TabletPanel />);
    await screen.findByTestId(`device-${deviceId}`);

    serveDevices([]);
    await user.click(screen.getByTestId(`revoke-${deviceId}`));

    await waitFor(() => expect(revoke).toHaveBeenCalledOnce());
    expect(await screen.findByTestId('devices-empty')).toBeInTheDocument();
  });

  it.each([
    [401, 'log in again'],
    [500, 'Something went wrong'],
  ])('explains a %s answer', async (status, message) => {
    server.use(http.get('/api/master/prompter/devices', () => new HttpResponse(null, { status })));
    render(<TabletPanel />);
    expect(await screen.findByTestId('tablet-error')).toHaveTextContent(message);
  });

  it('explains a failed pairing request', async () => {
    serveDevices();
    server.use(
      http.post('/api/master/prompter/pairing', () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    render(<TabletPanel />);

    await user.click(await screen.findByTestId('pairing-create'));
    expect(await screen.findByTestId('tablet-error')).toBeInTheDocument();
  });
});
