import { useState } from 'react';
import { ModeSelect } from './components/ModeSelect';
import { StandardGame } from './components/StandardGame';
import { IncrementalGame } from './incremental/IncrementalGame';

type Mode = 'select' | 'standard' | 'incremental';

export default function App() {
  const [mode, setMode] = useState<Mode>('select');

  if (mode === 'select') {
    return (
      <ModeSelect
        onSelectStandard={() => setMode('standard')}
        onSelectIncremental={() => setMode('incremental')}
      />
    );
  }

  if (mode === 'standard') {
    return <StandardGame onBackToMenu={() => setMode('select')} />;
  }

  return <IncrementalGame onBackToMenu={() => setMode('select')} />;
}
