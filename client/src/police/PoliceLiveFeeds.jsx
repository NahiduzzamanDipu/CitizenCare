import { useEffect, useState } from 'react';
import { Card, CardHeader, Badge, Alert } from '../ui/Card';
import { CCTVPage } from '../cctv-module';
import { api } from '../api/client';

export function PoliceLiveFeeds() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Live feeds
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Turn any camera into a CCTV node. Detections stream straight to the
          command dashboard.
        </p>
      </header>

      <AiServiceBanner />

      <Card>
        <CardHeader
          title="Camera on this device"
          subtitle="Pick a camera and start streaming. Analysis runs at one frame per second."
        />
        <div className="px-5 pb-5">
          <CCTVPage />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Adding more cameras"
          subtitle="Any phone or laptop with a browser can act as a camera node."
        />
        <div className="px-5 pb-5">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>
              Open this page on the other device and sign in with a police
              account.
            </li>
            <li>
              Give each device a distinct <strong>Camera ID</strong> — the
              dashboard groups feeds by that value, so duplicates overwrite each
              other.
            </li>
            <li>
              Set a <strong>Location name</strong> so alerts say where the camera
              is.
            </li>
            <li>Tap <strong>Start camera</strong> and leave the tab in the foreground.</li>
          </ol>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            Browsers only grant camera access over <strong>HTTPS</strong> or on{' '}
            <strong>localhost</strong>. To use a phone on your LAN, run the dev
            server behind HTTPS or a tunnel.
          </p>
        </div>
      </Card>
    </div>
  );
}

/** Tells the operator up front whether detection will actually run. */
function AiServiceBanner() {
  const [state, setState] = useState({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/cctv/ai-health')
      .then((d) => !cancelled && setState({ status: 'ok', data: d }))
      .catch((e) => !cancelled && setState({ status: 'down', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'checking') return null;

  if (state.status === 'down') {
    return (
      <Alert tone="amber">
        <strong>AI detection is offline.</strong> Cameras will still stream to the
        dashboard, but frames are not analysed. Start the Python service:{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">
          cd ai-model &amp;&amp; python app.py
        </code>
        <span className="mt-1 block text-xs opacity-80">{state.message}</span>
      </Alert>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
      <Badge tone="green">AI online</Badge>
      <span className="text-emerald-900 dark:text-emerald-200">
        Model <code className="font-mono">{state.data?.model || 'yolov8n.pt'}</code> ·
        confidence ≥ {state.data?.confThreshold ?? '0.25'}
      </span>
      {Array.isArray(state.data?.classes) && (
        <span className="text-xs text-emerald-800 dark:text-emerald-300">
          {state.data.classes.length} classes
        </span>
      )}
    </div>
  );
}
