import { useEffect } from 'react';
import SubtitleTranslatorPage from './features/subtitle-translator/SubtitleTranslatorPage';
import { appEnv } from './lib/config/env';

function App() {
  useEffect(() => {
    document.title = appEnv.appTitle;
  }, []);

  return <SubtitleTranslatorPage />;
}

export default App;
