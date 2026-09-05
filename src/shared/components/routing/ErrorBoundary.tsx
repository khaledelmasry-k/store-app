import { Component, VNode } from 'preact'
import { ErrorState } from '../ui/ErrorState'

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: VNode }, ErrorBoundaryState> {
  constructor(props: { children: VNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return <ErrorState title="حدث خطأ غير متوقع" description="تعذر عرض هذه الصفحة. أعد تحميلها للمحاولة مرة أخرى." onRetry={() => window.location.reload()} />
    }
    return this.props.children
  }
}
