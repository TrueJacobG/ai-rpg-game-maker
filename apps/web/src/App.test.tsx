import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { server } from './test-server';

afterEach(() => window.history.pushState({}, '', '/'));

describe('App', () => {
  it('shows the home page at the root', () => {
    render(<App />);
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('opens the prompter under /prompter', async () => {
    server.use(http.get('/api/prompter/me', () => new HttpResponse(null, { status: 401 })));
    window.history.pushState({}, '', '/prompter');
    render(<App />);
    expect(await screen.findByTestId('pair-form')).toBeInTheDocument();
  });
});
