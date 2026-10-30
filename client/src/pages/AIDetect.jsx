import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Card, CardHeader, Badge, Alert } from '../ui/Card';
import { Button } from '../ui/Field';

/** Confidence colouring so a weak match reads as weak at a glance. */
function confidenceTone(c) {
  if (c >= 0.7) return 'green';
  if (c >= 0.4) return 'amber';
  return 'slate';
}

export function AIDetect() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function run() {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('image', file);
      setResult(await api.post('/api/ai/detect', form));
    } catch (e) {
      setError(e.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  }

  const detections = Array.isArray(result?.detections) ? result.detections : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          AI object detection
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Run a single image through the same YOLOv8 model the live CCTV pipeline
          uses. Useful for checking the model before relying on it.
        </p>
      </header>

      <Card>
        <CardHeader title="Upload an image" />
        <div className="space-y-4 px-5 pb-5">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
              setError('');
            }}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
          />

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Selected"
              className="max-h-72 w-full rounded-xl border border-slate-200 object-contain dark:border-slate-700"
            />
          )}

          <Button onClick={run} disabled={!file} loading={loading} className="w-full">
            {loading ? 'Analysing…' : 'Run detection'}
          </Button>

          {error && <Alert>{error}</Alert>}
        </div>
      </Card>

      {result && (
        <Card>
          <CardHeader
            title="Results"
            subtitle={
              result.mode === 'demo'
                ? 'Demo output — no inference service is configured.'
                : result.message || 'Live inference'
            }
            right={
              <Badge tone={result.weaponDetected ? 'red' : 'green'}>
                {result.weaponDetected ? 'Weapon detected' : 'No threat'}
              </Badge>
            }
          />
          <div className="space-y-4 px-5 pb-5">
            {result.mode === 'demo' && (
              <Alert tone="amber">
                Set <code>PYTHON_AI_URL</code> in <code>server/.env</code> and start{' '}
                <code>ai-model/app.py</code> to run real inference.
              </Alert>
            )}

            {detections.length === 0 ? (
              <p className="text-sm text-slate-500">
                No objects were detected above the confidence threshold.
              </p>
            ) : (
              <ul className="space-y-2">
                {detections.map((d, i) => {
                  const conf = Number(d.confidence) || 0;
                  const pct = conf <= 1 ? conf * 100 : conf;
                  return (
                    <li
                      key={`${d.label}-${i}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {d.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <Badge tone={confidenceTone(conf)}>{pct.toFixed(0)}%</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {result.frameQuality?.warnings?.length > 0 && (
              <Alert tone="amber">
                Image quality: {result.frameQuality.warnings.join(', ').replace(/_/g, ' ')}.
                Detection accuracy drops on dark or blurry frames.
              </Alert>
            )}

            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              {showRaw ? 'Hide' : 'Show'} raw response
            </button>
            {showRaw && (
              <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
