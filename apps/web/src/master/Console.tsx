import { parseMasterMessage } from '@ai-rpg/core/realtime';
import { useState } from 'react';
import { useRoom } from '../lib/room';
import { CharactersPanel } from './CharactersPanel';
import { PartyPanel } from './PartyPanel';
import { PlotPanel } from './PlotPanel';
import { PartyVersionProvider } from './party-version';
import { StoryLogPanel } from './StoryLogPanel';
import { StoryProgressPanel } from './StoryProgressPanel';
import { StoryScreen } from './StoryScreen';
import { TabletPanel } from './TabletPanel';

const TABS = [
  { id: 'story', label: 'Story' },
  { id: 'dashboard', label: 'Dashboard' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export const Console = ({ onLogout }: { onLogout: () => void }) => {
  const room = useRoom('/api/master/ws', parseMasterMessage);
  const [tab, setTab] = useState<Tab>('story');

  return (
    <main className="master">
      <div className="topbar">
        <h1>Game master</h1>
        <nav className="tabs" aria-label="Console">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-testid={`tab-${entry.id}`}
              aria-pressed={tab === entry.id}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <button type="button" data-testid="logout" onClick={onLogout}>
          Log out
        </button>
      </div>
      <PartyVersionProvider>
        {tab === 'story' ? (
          <StoryScreen room={room} />
        ) : (
          <div className="dashboard-grid" data-testid="dashboard">
            <div>
              <StoryProgressPanel />
              <PlotPanel />
              <StoryLogPanel />
            </div>
            <div>
              <PartyPanel />
              <TabletPanel />
              <CharactersPanel />
            </div>
          </div>
        )}
      </PartyVersionProvider>
    </main>
  );
};
