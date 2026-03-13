import React from 'react';
import { Button, Card, Text, Title3 } from '@fluentui/react-components';

const containerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
  padding: '16px',
};

const cardStyle = {
  maxWidth: '620px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const errorTextStyle = {
  color: '#a4262c',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export default class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[TabErrorBoundary] Tab render failed:', error, errorInfo);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const tabLabel = this.props.tabLabel || this.props.tabId || 'вкладке';
    const message = String(error?.message || error || 'Unknown render error');

    return (
      <div style={containerStyle}>
        <Card appearance="filled-alternative" style={cardStyle} data-testid="tab-error-boundary">
          <Title3>{`Ошибка во вкладке: ${tabLabel}`}</Title3>
          <Text>
            Компонент вкладки завершился с ошибкой. Остальной интерфейс продолжает работать.
          </Text>
          <Text style={errorTextStyle} size={200}>{message}</Text>
          <div>
            <Button appearance="primary" onClick={this.handleRetry} id="btn-tab-retry" data-testid="btn-tab-retry">
              Повторить рендер
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
