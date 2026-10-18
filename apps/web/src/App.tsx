import { PrompterApp } from './prompter/PrompterApp';

export const App = () => {
  if (window.location.pathname.startsWith('/prompter')) return <PrompterApp />;
  return (
    <main className="form" data-testid="home">
      <h1>AI RPG Game Maker</h1>
      <a href="/prompter">Open the tablet prompter</a>
    </main>
  );
};
