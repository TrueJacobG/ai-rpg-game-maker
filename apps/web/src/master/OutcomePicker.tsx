import type { CurrentNode } from '@ai-rpg/core/story';

type OutcomePickerProps = {
  outcomes: CurrentNode['outcomes'];
  suggested: string | null;
  busy: boolean;
  onChoose: (outcome: string | null) => void;
};

export const OutcomePicker = ({ outcomes, suggested, busy, onChoose }: OutcomePickerProps) => (
  <div className="outcomes" data-testid="outcomes">
    {outcomes.map((outcome) => (
      <button
        key={outcome.id}
        type="button"
        className={outcome.id === suggested ? 'outcome primary' : 'outcome'}
        data-testid={`outcome-${outcome.id}`}
        data-suggested={String(outcome.id === suggested)}
        disabled={busy}
        onClick={() => onChoose(outcome.id)}
      >
        <strong>{outcome.label}</strong>
        {outcome.text !== '' && <span className="outcome-text">{outcome.text}</span>}
        {outcome.id === suggested && <em>Suggested by the AI</em>}
      </button>
    ))}
    <button
      type="button"
      className="outcome quiet"
      data-testid="outcome-none"
      disabled={busy}
      onClick={() => onChoose(null)}
    >
      Finish without a prepared result
    </button>
  </div>
);
