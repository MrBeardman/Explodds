import { useState } from 'react';
import { ModeSelect } from './components/ModeSelect';
import { StandardGame } from './components/StandardGame';
import { IncrementalGame } from './incremental/IncrementalGame';

type Mode = 'select' | 'standard' | 'incremental';

// Build version, fixed bottom-right on every screen (playtest reports need it)
function VersionTag() {
  return (
    <div
      className="fixed bottom-2 right-3 font-mono text-[11px] select-none pointer-events-none z-[60]"
      style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}
      title="Explodds build version"
    >
      v{__APP_VERSION__}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>('select');

  let screen;
  if (mode === 'select') {
    screen = (
      <ModeSelect
        onSelectStandard={() => setMode('standard')}
        onSelectIncremental={() => setMode('incremental')}
      />
    );
  } else if (mode === 'standard') {
    screen = <StandardGame onBackToMenu={() => setMode('select')} />;
  } else {
    screen = <IncrementalGame onBackToMenu={() => setMode('select')} />;
  }

  return (
    <>
      {screen}
      <VersionTag />
    </>
  );
}
