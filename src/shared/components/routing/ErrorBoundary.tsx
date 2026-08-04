import { Component, VNode } from 'preact'

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
      return (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <h1>حدث خطأ</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>إعادة التحميل</button>
        </div>
      )
    }
    return this.props.children
  }
}
