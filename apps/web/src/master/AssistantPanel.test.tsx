import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test-server';
import { AssistantPanel } from './AssistantPanel';

const answer = {
  text: 'Opcja pierwsza: ekipa znajduje ślad.',
  model: 'claude-opus-5-5',
  usage: { inputTokens: 120, outputTokens: 80, cacheReadTokens: 40_000, cacheWriteTokens: 0 },
};

let received: unknown[] = [];

const captureRequest = () => {
  received = [];
  server.use(
    http.post('/api/master/ai', async ({ request }) => {
      received = [...received, await request.json()];
      return HttpResponse.json(answer);
    }),
  );
};

describe('AssistantPanel', () => {
  it('suggests the next beat, with an optional note, and shows the answer and token use', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.type(screen.getByTestId('job-text'), 'They want to leave.');
    await user.click(screen.getByTestId('ai-ask'));

    expect(await screen.findByTestId('ai-answer')).toHaveTextContent(
      'Opcja pierwsza: ekipa znajduje ślad.',
    );
    expect(screen.getByTestId('ai-usage')).toHaveTextContent('120 in');
    expect(screen.getByTestId('ai-usage')).toHaveTextContent('40000 cached');
    expect(screen.getByTestId('ai-usage')).toHaveTextContent('claude-opus-5-5');
    expect(received).toEqual([{ type: 'next_beat', note: 'They want to leave.' }]);
  });

  it('asks for the next beat without a note', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('ai-ask'));

    await screen.findByTestId('ai-answer');
    expect(received).toEqual([{ type: 'next_beat' }]);
  });

  it('writes a bridge scene for what the players did', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('job-bridge'));
    expect(screen.getByTestId('ai-ask')).toBeDisabled();
    await user.type(screen.getByTestId('job-text'), 'They went to the casino.');
    await user.click(screen.getByTestId('ai-ask'));

    await screen.findByTestId('ai-answer');
    expect(received).toEqual([{ type: 'bridge', situation: 'They went to the casino.' }]);
  });

  it('generates the chosen kind of thing from a brief', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('job-generate'));
    await user.selectOptions(screen.getByTestId('job-what'), 'quest');
    await user.type(screen.getByTestId('job-text'), 'A side job at the docks.');
    await user.click(screen.getByTestId('ai-ask'));

    await screen.findByTestId('ai-answer');
    expect(received).toEqual([
      { type: 'generate', what: 'quest', brief: 'A side job at the docks.' },
    ]);
  });

  it('writes a recap from the log without any input', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('job-recap'));
    expect(screen.queryByTestId('job-text')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('ai-ask'));

    await screen.findByTestId('ai-answer');
    expect(received).toEqual([{ type: 'recap' }]);
  });

  it('answers questions about the canon', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('job-ask'));
    await user.type(screen.getByTestId('job-text'), 'What does Helix want?');
    await user.click(screen.getByTestId('ai-ask'));

    await screen.findByTestId('ai-answer');
    expect(received).toEqual([{ type: 'ask', question: 'What does Helix want?' }]);
  });

  it('clears the input and the old answer when switching jobs', async () => {
    captureRequest();
    const user = userEvent.setup();
    render(<AssistantPanel />);
    await user.type(screen.getByTestId('job-text'), 'note');
    await user.click(screen.getByTestId('ai-ask'));
    await screen.findByTestId('ai-answer');

    await user.click(screen.getByTestId('job-bridge'));

    expect(screen.queryByTestId('ai-answer')).not.toBeInTheDocument();
    expect(screen.getByTestId('job-text')).toHaveValue('');
  });

  it('is busy while waiting for the AI', async () => {
    let release = () => {};
    server.use(
      http.post('/api/master/ai', async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.json(answer);
      }),
    );
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('ai-ask'));
    expect(screen.getByTestId('ai-ask')).toBeDisabled();
    expect(screen.getByTestId('ai-busy')).toBeInTheDocument();

    release();
    await screen.findByTestId('ai-answer');
    await waitFor(() => expect(screen.getByTestId('ai-ask')).toBeEnabled());
  });

  it.each([
    [404, 'Import a world pack'],
    [503, 'not set up'],
    [422, 'declined'],
    [429, 'busy'],
    [502, 'failed'],
    [401, 'log in again'],
    [400, 'failed'],
  ])('explains a %s answer', async (status, message) => {
    server.use(http.post('/api/master/ai', () => new HttpResponse(null, { status })));
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('ai-ask'));
    expect(await screen.findByTestId('ai-error')).toHaveTextContent(message);
  });

  it('says so when the server cannot be reached', async () => {
    server.use(http.post('/api/master/ai', () => HttpResponse.error()));
    const user = userEvent.setup();
    render(<AssistantPanel />);

    await user.click(screen.getByTestId('ai-ask'));
    expect(await screen.findByTestId('ai-error')).toHaveTextContent('Cannot reach');
  });
});
