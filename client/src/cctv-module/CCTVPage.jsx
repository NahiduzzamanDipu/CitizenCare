import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const FRAME_INTERVAL_MS = 1000;
const MAX_CAPTURE_WIDTH = 640;

/**
 * Mobile / desktop CCTV: WebRTC camera → JPEG frames → Node → Python YOLOv8.
 * Boxes are drawn in the same coordinate space as the AI response (resized frame).
 */
export function CCTVPage() {
  const videoRef = useRef(null);
  const captureRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const locRef = useRef({ lat: '', lng: '' });
  const inFlightRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [lastWeapon, setLastWeapon] = useState(false);
  const [cameraId, setCameraId] = useState('CAM-01');
  const [place, setPlace] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [permissionState, setPermissionState] = useState('unknown'); // unknown | granted | denied
  const [cameraConnected, setCameraConnected] = useState(false);
  const [aiDown, setAiDown] = useState(false);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
    setCameraConnected(false);
    setStatus('Camera stopped.');
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setDevices([]);
        return;
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || 'Camera',
          groupId: d.groupId,
        }));
      setDevices(vids);
      // If the currently selected device disappeared, clear selection.
      if (selectedDeviceId && !vids.some((d) => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId('');
      }
    } catch {
      setDevices([]);
    }
  }, [selectedDeviceId]);

  // On first load, request permission (if needed) so Camo device label is visible.
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        await refreshDevices();
        const hasLabels = (devices || []).some((d) => d.label && d.label !== 'Camera');
        if (hasLabels) return;
        if (!navigator.mediaDevices?.getUserMedia) return;
        // Request permission once, then stop immediately (we will re-open on Start).
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach((t) => t.stop());
        if (!cancelled) setPermissionState('granted');
        await refreshDevices();
      } catch {
        if (!cancelled) setPermissionState('denied');
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const selectedDeviceLabel = useMemo(() => {
    if (!selectedDeviceId) return '';
    return devices.find((d) => d.deviceId === selectedDeviceId)?.label || '';
  }, [devices, selectedDeviceId]);

  const drawOverlay = useCallback((detections, fw, fh, weaponDetected) => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;

    const rect = video.getBoundingClientRect();
    overlay.width = rect.width * (window.devicePixelRatio || 1);
    overlay.height = rect.height * (window.devicePixelRatio || 1);
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!fw || !fh || !detections?.length) return;

    const sx = rect.width / fw;
    const sy = rect.height / fh;

    for (const d of detections) {
      const b = d.box;
      if (!b) continue;
      const x1 = b.x1 * sx;
      const y1 = b.y1 * sy;
      const w = (b.x2 - b.x1) * sx;
      const h = (b.y2 - b.y1) * sy;
      const threatPattern =
        /knife|gun|scissors|bat|weapon|blade|rifle|pistol|possible weapon/i;
      const isThreat =
        weaponDetected &&
        d.label &&
        (threatPattern.test(d.label) || d.heuristic === true);
      ctx.strokeStyle = isThreat
        ? 'rgba(239, 68, 68, 0.95)'
        : 'rgba(37, 99, 235, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, w, h);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.font = '12px system-ui';
      const conf = typeof d.confidence === 'number' ? d.confidence : 0;
      const pct = conf <= 1 ? (conf * 100).toFixed(0) : conf.toFixed(0);
      const label = isThreat ? `Weapon Detected ${pct}%` : `${d.label} ${pct}%`;
      const tw = ctx.measureText(label).width;
      ctx.fillRect(x1, y1 - 18, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x1 + 4, y1 - 5);
    }
  }, []);

  const sendFrame = useCallback(async () => {
    const video = videoRef.current;
    const capture = captureRef.current;
    if (!video || !capture || video.readyState < 2 || inFlightRef.current) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const cw = Math.min(MAX_CAPTURE_WIDTH, vw);
    const ch = Math.round((cw / vw) * vh);
    capture.width = cw;
    capture.height = ch;

    const cctx = capture.getContext('2d');
    if (!cctx) return;
    cctx.drawImage(video, 0, 0, cw, ch);

    await new Promise((resolve) => {
      capture.toBlob(
        async (blob) => {
          if (!blob) {
            resolve();
            return;
          }
          inFlightRef.current = true;
          try {
            const form = new FormData();
            form.append('frame', blob, 'frame.jpg');
            form.append('cameraId', cameraId);
            form.append('place', place);
            const { lat, lng } = locRef.current;
            if (lat) form.append('lat', lat);
            if (lng) form.append('lng', lng);

            const data = await api.post('/api/cctv/upload-frame', form);
            const wd = Boolean(data.weaponDetected);
            setLastWeapon(wd);
            setAiDown(Boolean(data.aiUnavailable));

            const names = Array.isArray(data.detectedClasses)
              ? data.detectedClasses.join(', ')
              : '';
            if (data.aiUnavailable) {
              setStatus(
                'AI service unreachable — streaming, but frames are not analysed. Start ai-model/app.py.'
              );
            } else if (wd) {
              setStatus('Weapon / suspicious object detected — alert sent to command.');
            } else if (names) {
              setStatus(`Scanning… no threat flagged. Detected: ${names}`);
            } else {
              setStatus('Scanning… no threat flagged. No objects detected.');
            }
            drawOverlay(
              data.detections,
              data.frameWidth,
              data.frameHeight,
              wd
            );
          } catch (e) {
            setStatus(
              e.status === 401
                ? 'Session expired — sign in again to keep streaming.'
                : e.message || 'Frame upload failed'
            );
          } finally {
            inFlightRef.current = false;
            resolve();
          }
        },
        'image/jpeg',
        0.8
      );
    });
  }, [drawOverlay, cameraId, place]);

  const startCamera = useCallback(async () => {
    setStatus('Starting camera…');
    try {
      const constraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      setCameraConnected(true);
      setPermissionState('granted');
      setStatus(
        `Camera Connected ✅${selectedDeviceLabel ? ` (${selectedDeviceLabel})` : ''} — AI Running… (1 frame/sec)`
      );

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            locRef.current = {
              lat: String(pos.coords.latitude),
              lng: String(pos.coords.longitude),
            };
          },
          () => {}
        );
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        sendFrame();
      }, FRAME_INTERVAL_MS);
    } catch {
      setCameraConnected(false);
      setPermissionState('denied');
      setStatus('Camera permission denied or not available.');
    }
  }, [sendFrame, selectedDeviceId, selectedDeviceLabel]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // NOTE: do not auto-start camera. On many browsers, device selection and camera
  // access require an explicit user gesture (especially with virtual cameras like Camo).

  useEffect(() => {
    if (!running) return undefined;
    const onResize = () => {
      const overlay = overlayRef.current;
      const video = videoRef.current;
      if (!overlay || !video) return;
      const ctx = overlay.getContext('2d');
      const rect = video.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      overlay.width = rect.width * dpr;
      overlay.height = rect.height * dpr;
      ctx?.clearRect(0, 0, overlay.width, overlay.height);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [running]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Live AI CCTV
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          This device&rsquo;s camera sends roughly <strong>one JPEG per second</strong> to
          the API, which forwards it to the Python YOLOv8 service. Detected objects are
          drawn over the video, and a weapon match alerts every officer on duty
          instantly.
        </p>
      </div>

      {aiDown && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          <strong>AI service unavailable.</strong> The camera is streaming and the
          command dashboard sees the feed, but frames are not being analysed.
          Start the Python service in <code>ai-model/</code> and check{' '}
          <code>PYTHON_AI_URL</code> in <code>server/.env</code>.
        </div>
      )}

      {lastWeapon && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100">
          <strong>Weapon detected.</strong> Officers on duty have been alerted in
          real time and the event has been recorded.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={running ? stopCamera : startCamera}
          className={
            running
              ? "rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              : "rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
          }
        >
          {running ? 'Stop camera' : 'Start camera'}
        </button>
        <span className="self-center text-sm text-slate-500 dark:text-slate-400">
          {cameraConnected ? 'Camera Connected ✅' : ''}{' '}
          {permissionState === 'denied' ? 'Camera permission blocked.' : ''}
        </span>
        <span className="self-center text-sm text-slate-500 dark:text-slate-400">{status}</span>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500">Select Camera</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={running}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">
              {devices.length ? 'Default camera (auto)' : 'No cameras found'}
            </option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refreshDevices}
            disabled={running}
            className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            Refresh devices
          </button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Tip: start Camo Studio first, then refresh. If labels are missing, allow camera permission once.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Camera ID</label>
          <input
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Location name</label>
          <input
            value={place}
            placeholder="e.g. Main gate"
            onChange={(e) => setPlace(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg dark:border-slate-700">
        <video
          ref={videoRef}
          className="block w-full"
          playsInline
          muted
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute left-0 top-0 h-full w-full"
        />
      </div>

      <canvas ref={captureRef} className="hidden" />
    </div>
  );
}
