import { useEffect, useState } from 'react';

export const FullscreenButton = () => {
  const [active, setActive] = useState(() => document.fullscreenElement != null);

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!document.fullscreenEnabled) return null;

  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      return;
    }
  };

  return (
    <button type="button" data-testid="fullscreen" onClick={toggle}>
      {active ? 'Exit full screen' : 'Full screen'}
    </button>
  );
};
