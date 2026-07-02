import { useEffect } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';

export function App() {
  const { snapshot, start, hit, backToTitle } = useGameEngine();
  const { phase } = snapshot;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      if (phase === 'playing') {
        hit();
      } else {
        start();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, hit, start]);

  if (phase === 'playing') {
    return <GameScreen snapshot={snapshot} onHit={hit} />;
  }
  if (phase === 'result' && snapshot.rank !== null) {
    return (
      <ResultScreen
        score={snapshot.score}
        rank={snapshot.rank}
        onRetry={start}
        onBackToTitle={backToTitle}
      />
    );
  }
  return <TitleScreen onStart={start} />;
}
