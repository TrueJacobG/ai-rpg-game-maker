import { useMemo } from 'react';
import { encode } from 'uqr';

const QUIET_ZONE = 2;

export const QrCode = ({ text, label }: { text: string; label: string }) => {
  const { size, path } = useMemo(() => {
    const { data, size: modules } = encode(text);
    const squares = data.flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])),
    );
    return { size: modules, path: squares.join('') };
  }, [text]);
  const extent = size + QUIET_ZONE * 2;

  return (
    <svg
      className="qr"
      data-testid="qr"
      role="img"
      aria-label={label}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#fff" />
      <path data-testid="qr-modules" d={path} fill="#000" />
    </svg>
  );
};
