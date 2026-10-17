/**
 * Top-level ErrorBoundary (RT-633). Catches render errors outside the data
 * router (providers, the router itself); route render errors are caught by the
 * router's root `errorElement` (RouteErrorFallback). Both report to Sentry and
 * render the same safe fallback.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "./ErrorFallback";
import { reportError } from "./report";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    // The component stack is not sent: contract section 3.1 drops `contexts`.
    reportError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}
