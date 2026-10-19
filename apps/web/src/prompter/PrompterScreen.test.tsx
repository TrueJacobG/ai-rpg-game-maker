import type { PrompterView } from '@ai-rpg/core/realtime';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrompterScreen } from './PrompterScreen';

const decision = {
  prompt: 'How do you escape the patrol?',
  slots: [
    { key: 'who', label: 'Who' },
    { key: 'where', label: 'Where' },
  ],
};

const views = {
  listen: { phase: 'listen', scene: null },
  debate: { phase: 'debate', scene: null, decision, missing: ['where'] },
  answer: { phase: 'answer', scene: null, decision, missing: [], transcript: '' },
  roll: {
    phase: 'roll',
    scene: null,
    roll: {
      label: 'Kira rolls Reflex',
      result: { natural: 17, total: 20, target: 15, success: true, critical: null },
    },
  },
  break: { phase: 'break', scene: null },
} satisfies Record<string, PrompterView>;

const show = (
  view: PrompterView | null,
  options: {
    connection?: 'open' | 'connecting' | 'closed';
    micError?: 'mic_blocked' | 'network' | null;
    supported?: boolean;
  } = {},
) =>
  render(
    <PrompterScreen
      view={view}
      connection={options.connection ?? 'open'}
      micError={options.micError ?? null}
      supported={options.supported ?? true}
    />,
  );

describe('PrompterScreen phase badge', () => {
  it.each([
    ['listen', 'LISTEN'],
    ['debate', 'INTERACTION'],
    ['answer', 'ANSWER'],
    ['roll', 'ROLL'],
    ['break', 'BREAK'],
  ] as const)('shows %s in the corner', (phase, label) => {
    show(views[phase]);
    expect(screen.getByTestId('phase-badge')).toHaveTextContent(label);
    expect(screen.getByTestId('prompter')).toHaveAttribute('data-phase', phase);
  });

  it('waits for the master before the first state arrives', () => {
    show(null);
    expect(screen.getByTestId('waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('phase-badge')).not.toBeInTheDocument();
  });
});

describe('PrompterScreen microphone indicator', () => {
  it('shows a loud LISTENING banner only while answering', () => {
    show(views.answer);
    const banner = screen.getByTestId('mic-banner');
    expect(banner).toHaveTextContent('LISTENING');
    expect(banner).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('mic-frame')).toBeInTheDocument();
  });

  it.each(['listen', 'debate', 'roll', 'break'] as const)('is absent in %s', (phase) => {
    show(views[phase]);
    expect(screen.queryByTestId('mic-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mic-frame')).not.toBeInTheDocument();
  });

  it('says NOT LISTENING when the microphone is blocked', () => {
    show(views.answer, { micError: 'mic_blocked' });
    expect(screen.getByTestId('mic-error')).toHaveTextContent('NOT LISTENING');
    expect(screen.queryByTestId('mic-banner')).not.toBeInTheDocument();
  });

  it('keeps listening but warns about a network problem', () => {
    show(views.answer, { micError: 'network' });
    expect(screen.getByTestId('mic-banner')).toHaveTextContent('LISTENING');
    expect(screen.getByTestId('mic-warning')).toBeInTheDocument();
  });

  it('says NOT LISTENING when the browser cannot recognise speech', () => {
    show(views.answer, { supported: false });
    expect(screen.getByTestId('mic-error')).toHaveTextContent('NOT LISTENING');
    expect(screen.queryByTestId('mic-banner')).not.toBeInTheDocument();
  });
});

describe('PrompterScreen content', () => {
  it('shows the prompt and highlights the slots still missing', () => {
    show(views.debate);
    expect(screen.getByTestId('decision-prompt')).toHaveTextContent(
      'How do you escape the patrol?',
    );
    expect(screen.getByTestId('slot-who')).toHaveAttribute('data-missing', 'false');
    expect(screen.getByTestId('slot-where')).toHaveAttribute('data-missing', 'true');
  });

  it('shows the live transcript while answering', () => {
    show({ ...views.answer, transcript: 'We run to the docks' });
    expect(screen.getByTestId('transcript')).toHaveTextContent('We run to the docks');
  });

  it('invites the players to speak before any words arrive', () => {
    show(views.answer);
    expect(screen.getByTestId('transcript')).toHaveTextContent('Say your answer');
  });

  it('shows the scene image', () => {
    show({ phase: 'listen', scene: '/scenes/docks.png' });
    expect(screen.getByTestId('scene')).toHaveAttribute('src', '/scenes/docks.png');
  });

  it('shows no scene image without a scene', () => {
    show(views.listen);
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
  });

  it.each(['roll', 'break'] as const)(
    'falls back to the story hint for the retired %s phase',
    (phase) => {
      show(views[phase]);
      expect(screen.getByText('The master is telling the story')).toBeInTheDocument();
      expect(screen.queryByTestId('roll')).not.toBeInTheDocument();
    },
  );
});

describe('PrompterScreen connection', () => {
  it('stays quiet while connected', () => {
    show(views.listen, { connection: 'open' });
    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();
  });

  it.each(['connecting', 'closed'] as const)('shows a reconnecting pill when %s', (connection) => {
    show(views.listen, { connection });
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });
});
