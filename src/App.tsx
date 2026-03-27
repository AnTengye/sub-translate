import { useEffect } from 'react';
import { ToastProvider } from './components/ui/feedback/ToastProvider';
import SubtitleTranslatorPage from './features/subtitle-translator/SubtitleTranslatorPage';
import { appEnv } from './lib/config/env';

function App() {
  useEffect(() => {
    document.title = appEnv.appTitle;
  }, []);

  return (
    <ToastProvider>
      <SubtitleTranslatorPage />
    </ToastProvider>
  );
}

export default App;
