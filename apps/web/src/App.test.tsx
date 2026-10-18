import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { FakeWebSocket } from './test-fakes';
import { server } from './test-server';

beforeEach(() => FakeWebSocket.install());
afterEach(() => window.history.pushState({}, '', '/'));

describe('App', () => {
  it('shows the home page at the root', () => {
    render(<App />);
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('opens a player sheet under /p/<token>', async () => {
    const token = 'a'.repeat(43);
    server.use(http.get(`/api/player/${token}`, () => new HttpResponse(null, { status: 404 })));
    window.history.pushState({}, '', `/p/${token}`);
    render(<App />);
    expect(await screen.findByTestId('player-invalid')).toBeInTheDocument();
  });

  it('shows the home page for a malformed player link', () => {
    window.history.pushState({}, '', '/p/short');
    render(<App />);
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('opens the master panel under /master', async () => {
    server.use(http.get('/api/master/me', () => new HttpResponse(null, { status: 401 })));
    window.history.pushState({}, '', '/master');
    render(<App />);
    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
  });

  it('opens the prompter under /prompter', async () => {
    server.use(http.get('/api/prompter/me', () => new HttpResponse(null, { status: 401 })));
    window.history.pushState({}, '', '/prompter');
    render(<App />);
    expect(await screen.findByTestId('pair-form')).toBeInTheDocument();
  });
});
