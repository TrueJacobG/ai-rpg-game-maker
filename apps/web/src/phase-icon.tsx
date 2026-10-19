import type { Phase } from './phases';

const GLYPHS = {
  listen: (
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10 8.5a5 5 0 0 1 0 7" />
      <path d="M13.5 5.5a9 9 0 0 1 0 13" />
      <path d="M17 3a13 13 0 0 1 0 18" />
    </>
  ),
  debate: (
    <>
      <path d="M3.5 5h17v11.5H11l-4.5 3.5v-3.5h-3z" />
      <circle cx="8.5" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  answer: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </>
  ),
  roll: (
    <>
      <path d="M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5z" />
      <path d="M12 7.5 16.5 15h-9z" />
      <path d="M12 7.5v-5M16.5 15l4 1.75M7.5 15l-4 1.75" />
    </>
  ),
  break: (
    <>
      <path d="M5 9.5h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 3.5c-1 1 1 2 0 3.5M12 3.5c-1 1 1 2 0 3.5" />
    </>
  ),
} as const satisfies Record<Phase, React.ReactNode>;

export const PhaseIcon = ({ phase }: { phase: Phase }) => (
  <svg
    className="phase-icon"
    data-testid={`phase-icon-${phase}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {GLYPHS[phase]}
  </svg>
);
