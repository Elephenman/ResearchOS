import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Top-level error boundary for the entire app.
 * Catches rendering errors in any child component and displays
 * a friendly crash screen with a retry button.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#141414',
        }}>
          <Result
            status="error"
            title="应用遇到了问题"
            subTitle="ResearchOS 发生了意外错误，请尝试重置或重新加载应用。"
            extra={[
              <Button key="reset" onClick={this.handleReset}>
                重置页面
              </Button>,
              <Button key="reload" type="primary" onClick={this.handleReload}>
                重新加载
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{
                textAlign: 'left',
                maxWidth: 600,
                margin: '16px auto',
                padding: 16,
                background: '#1a1a1a',
                borderRadius: 8,
                overflow: 'auto',
                maxHeight: 200,
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#ff7875',
              }}>
                <div><strong>{this.state.error.toString()}</strong></div>
                {this.state.errorInfo?.componentStack && (
                  <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
