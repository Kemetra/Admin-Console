/**
 * Root `errorElement` of the data router (RT-633). A data router catches route
 * render and loader errors itself, so they never reach AppErrorBoundary; this
 * reports them once and renders the same safe fallback.
 */
import { useEffect } from "react";
import { useRouteError } from "react-router";
import { ErrorFallback } from "./ErrorFallback";
import { reportError } from "./report";

export function RouteErrorFallback(): React.JSX.Element {
  const error = useRouteError();
  useEffect(() => {
    reportError(error);
  }, [error]);
  return <ErrorFallback />;
}
