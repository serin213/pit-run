import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** 에러 발생 시 호출 (외부 에러 리포팅 연동용) */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * 앱 루트에 배치하는 글로벌 에러 경계.
 * React 렌더 트리에서 잡히지 않은 에러를 포착해 앱 전체 크래시를 방지.
 * Error Boundaries는 함수 컴포넌트로 구현 불가 — 반드시 클래스 컴포넌트 필요.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.inner}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>예상치 못한 오류가 발생했어요</Text>
            <Text style={styles.message}>
              {this.state.error?.message ?? '알 수 없는 오류'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={this.handleRetry}
            >
              <Text style={styles.buttonText}>다시 시도</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171C',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#8888AA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#E8002D',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
