import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded route modules — each becomes a separate chunk
const HomePage = lazy(() => import('./modules/home/HomePage'));
const LibraryPage = lazy(() => import('./modules/library/LibraryPage'));
const SearchPage = lazy(() => import('./modules/search/SearchPage'));
const ReaderPage = lazy(() => import('./modules/reader/ReaderPage'));
const AIPage = lazy(() => import('./modules/ai/AIPage'));
const CitationPage = lazy(() => import('./modules/citation/CitationPage'));
const GraphPage = lazy(() => import('./modules/graph/GraphPage'));
const ReviewPage = lazy(() => import('./modules/review/ReviewPage'));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'));

/** Full-page loading spinner for lazy routes */
const PageLoader: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', minHeight: 320,
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#1677FF',
            borderRadius: 6,
            fontFamily: "'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
          },
          components: {
            Layout: { siderBg: '#1a1a1a', headerBg: '#141414', bodyBg: '#141414' },
            Menu: { darkItemBg: '#1a1a1a', darkSubMenuItemBg: '#141414' },
          },
        }}
      >
        <Router>
          <MainLayout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/reader/:paperId" element={<ReaderPage />} />
                <Route path="/ai" element={<AIPage />} />
                <Route path="/citation" element={<CitationPage />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </MainLayout>
        </Router>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;
