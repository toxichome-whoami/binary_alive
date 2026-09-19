import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Footer } from './Footer';
import { AiAssistantDrawer } from '../ai/AiAssistantDrawer';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Layout ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-[1200px] mx-auto p-6 rounded-[8px] border border-[#26282A] bg-[#161718] text-white space-y-3 my-6">
          <div className="text-[16px] font-semibold text-[#ef4444]">Application Error</div>
          <p className="text-[13px] text-[#A1A1A1]">
            An unexpected rendering error occurred. Please refresh the page.
          </p>
          <pre className="text-[12px] font-mono text-[#8c8c8c] bg-[#0e0e0e] p-3 rounded-[6px] overflow-x-auto border border-[#26282A]">
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="h-8 px-3 rounded-[6px] text-[13px] font-medium bg-[#2f80ed] hover:bg-[#266fd5] text-white cursor-pointer transition-colors"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0c0c0c] text-gray-100 font-sans transition-colors">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopBar 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleAiPanel={() => setIsAiPanelOpen(!isAiPanelOpen)}
          isAiPanelOpen={isAiPanelOpen}
        />

        <main className="flex-1 px-3 sm:px-5 py-6 w-full flex flex-col items-center">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Cloudflare Production Site Footer from conter.html */}
        <Footer />
      </div>

      <AiAssistantDrawer 
        isOpen={isAiPanelOpen}
        onClose={() => setIsAiPanelOpen(false)}
      />
    </div>
  );
};
