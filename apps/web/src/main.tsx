/**
 * @file main
 * @description Application entry: mounts the React tree with the I18nProvider,
 * theme provider, auth provider, and a top-level error boundary.
 *
 * Responsibilities:
 * - Resolve the initial locale from cookie / localStorage / navigator
 * - Wrap the router in `ThemeProvider`, `AuthProvider`, `I18nProvider`, and
 *   a top-level `ErrorBoundary` so a crash anywhere below renders a branded
 *   fallback instead of a blank page
 * - Sync the active locale to `<html lang>` on every change (handled inside
 *   `I18nProvider`)
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/i18n/useT";
import { CATALOGS } from "@/i18n/catalogs";
import { makeStorageAdapter, resolveInitialLocale } from "@/i18n/adapters/storageCookieAdapter";
import { router } from "@/app/router";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import "@/styles/global.css";

const storage = makeStorageAdapter();
const initialLocale = resolveInitialLocale();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider
      catalogs={CATALOGS}
      initialLocale={initialLocale}
      storageAdapter={storage}
    >
      <ThemeProvider>
        <AuthProvider>
          {/* R-09 L1: top-level boundary so a crash below renders a branded fallback. */}
          <ErrorBoundary name="root">
            <RouterProvider router={router} />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
