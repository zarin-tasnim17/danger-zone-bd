import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import ToastContainer from '@/components/ui/ToastContainer';
import IncidentFeed from '@/components/incidents/IncidentFeed';
import SafetyTutorialModal, {
  SAFETY_TERMS_LIST,
  SAFETY_TERMS_ACCEPTED_KEY,
  SAFETY_TERMS_CONSENTS_KEY,
} from '@/components/emergency/SafetyTutorialModal';
import { useIncidentStore } from '@/store/useIncidentStore';
import { useToastStore } from '@/store/useToastStore';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';

describe('[Components][Mocked] React UI Rendering, Loading States & SSR Hydration Safety', () => {
  let sandbox: BrowserSandboxHandle;

  beforeEach(() => {
    sandbox = installBrowserGlobals();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Badge renders severity, pulse indicator, and verification variants deterministically', () => {
    const html = renderToStaticMarkup(
      React.createElement(Badge, { variant: 'CRITICAL', pulse: true, children: 'CRITICAL ALERT' })
    );
    assert.ok(html.includes('CRITICAL ALERT'));
    assert.ok(html.includes('animate-ping'));

    const verifiedHtml = renderToStaticMarkup(
      React.createElement(Badge, { variant: 'VERIFIED', children: 'RESPONDER' })
    );
    assert.ok(verifiedHtml.includes('RESPONDER'));
  });

  it('Button & GlassCard render loading disabled states and container variants without SSR crashes', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlassCard, {
        hover: true,
        children: React.createElement(Button, {
          variant: 'danger',
          isLoading: true,
          disabled: true,
          children: 'Submitting Alert...',
        }),
      })
    );
    assert.ok(html.includes('Submitting Alert...'));
    assert.ok(html.includes('disabled'));
    assert.ok(html.includes('bg-red-600'));
  });

  it('IncidentFeed & ToastContainer SSR snapshots match React 18 getInitialState safely (hydrated tests run in Browser E2E)', () => {
    // React 18 renderToStaticMarkup invokes Zustand getServerSnapshot (getInitialState)
    assert.equal(useIncidentStore.getInitialState().isLoading, true);
    const feedSsrHtml = renderToStaticMarkup(React.createElement(IncidentFeed));
    assert.ok(feedSsrHtml.includes('animate-pulse'));

    assert.deepEqual(useToastStore.getInitialState().toasts, []);
    const toastSsrHtml = renderToStaticMarkup(React.createElement(ToastContainer));
    assert.equal(toastSsrHtml, '');
  });

  it('SafetyTutorialModal exports complete legal terms and renders safely', () => {
    assert.equal(SAFETY_TERMS_LIST.length, 6);
    const requiredTerms = SAFETY_TERMS_LIST.filter((t) => t.required);
    assert.equal(requiredTerms.length, 4);

    const ids = SAFETY_TERMS_LIST.map((t) => t.id);
    assert.ok(ids.includes('emergency_999'));
    assert.ok(ids.includes('cyber_security_act'));
    assert.ok(ids.includes('location_privacy_fuzzing'));
    assert.ok(ids.includes('community_moderation'));
    assert.ok(ids.includes('proximity_alerts'));
    assert.ok(ids.includes('safe_route_telemetry'));

    assert.equal(SAFETY_TERMS_ACCEPTED_KEY, 'bd_safety_agreement_accepted');
    assert.equal(SAFETY_TERMS_CONSENTS_KEY, 'bd_safety_terms_consents');

    // SSR render when closed returns empty string
    const modalHtml = renderToStaticMarkup(React.createElement(SafetyTutorialModal));
    assert.equal(modalHtml, '');
  });
});
