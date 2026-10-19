import { Home } from './Home';
import { MasterApp } from './master/MasterApp';
import { PlayerApp } from './player/PlayerApp';
import { PrompterApp } from './prompter/PrompterApp';

export const App = () => {
  const { pathname } = window.location;
  if (pathname.startsWith('/prompter')) return <PrompterApp />;
  if (pathname.startsWith('/master')) return <MasterApp />;
  const player = /^\/p\/([A-Za-z0-9_-]{43})\/?$/.exec(pathname);
  if (player?.[1]) return <PlayerApp token={player[1]} />;
  return <Home />;
};
