import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { LocationPicker } from '../maps/LocationPicker';
import { TextInput, TextArea, Select, Button } from '../ui/Field';
import { Alert } from '../ui/Card';

const CRIME_TYPES = [
  { value: 'theft', label: 'Theft' },
  { value: 'assault', label: 'Assault' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'traffic', label: 'Traffic incident' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'drugs', label: 'Drugs' },
  { value: 'other', label: 'Other' },
];

const MAX_FILES = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function ReportCrime({ compact = false, onSubmitted }) {
  const [params] = useSearchParams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [crimeType, setCrimeType] = useState('other');
  const [point, setPoint] = useState({ lat: null, lng: null, address: '' });
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Allow deep-linking a location, e.g. from the map: /report?lat=..&lng=..
  useEffect(() => {
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
      setPoint((p) => (p.lat === null ? { lat, lng, address: '' } : p));
    }
  }, [params]);

  const hasLocation = Number.isFinite(point.lat) && Number.isFinite(point.lng);
  const canSubmit =
    title.trim() && description.trim() && hasLocation && !submitting;

  const previews = useMemo(
    () =>
      files.map((f) => ({
        name: f.name,
        size: f.size,
        url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        isVideo: f.type.startsWith('video/'),
      })),
    [files]
  );

  // Object URLs leak memory unless they are revoked when the list changes.
  useEffect(() => {
    return () => {
      for (const p of previews) if (p.url) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

  function onFilesChosen(e) {
    const chosen = Array.from(e.target.files || []);
    const tooBig = chosen.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setStatus({
        type: 'error',
        text: `"${tooBig.name}" is larger than 25 MB. Choose a smaller file.`,
      });
      e.target.value = '';
      return;
    }
    if (chosen.length > MAX_FILES) {
      setStatus({ type: 'error', text: `Attach at most ${MAX_FILES} files.` });
      e.target.value = '';
      return;
    }
    setStatus(null);
    setFiles(chosen);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasLocation) {
      setStatus({ type: 'error', text: 'Pick the incident location first.' });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('crimeType', crimeType);
      form.append('lat', String(point.lat));
      form.append('lng', String(point.lng));
      if (point.address) form.append('address', point.address);
      for (const f of files) form.append('media', f);

      const report = await api.post('/api/reports', form);

      setStatus({
        type: 'ok',
        text: 'Report submitted. An officer will review it shortly — you will be notified of the outcome.',
      });
      setTitle('');
      setDescription('');
      setFiles([]);
      onSubmitted?.(report);
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Failed to submit report.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={compact ? '' : 'mx-auto max-w-2xl'}>
      {!compact && (
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Report an incident
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Give responders what they need: what happened, where, and any evidence
            you have.
          </p>
        </header>
      )}

      <form
        onSubmit={handleSubmit}
        className={
          compact
            ? 'space-y-5'
            : 'space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'
        }
      >
        {status && (
          <Alert tone={status.type === 'ok' ? 'green' : 'red'}>{status.text}</Alert>
        )}

        <TextInput
          label="What happened?"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Phone snatched near the bus stop"
        />

        <Select
          label="Category"
          value={crimeType}
          onChange={(e) => setCrimeType(e.target.value)}
        >
          {CRIME_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        <TextArea
          label="Details"
          required
          rows={5}
          maxLength={8000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you saw: time, people involved, direction of travel, vehicles…"
          hint={`${description.length}/8000 characters`}
        />

        <LocationPicker value={point} onChange={setPoint} height={280} />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Photos or video (optional)
          </label>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={onFilesChosen}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Up to {MAX_FILES} files, 25 MB each. JPEG, PNG, GIF, WebP, MP4, WebM or MOV.
          </p>

          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {previews.map((p) => (
                <div
                  key={p.name}
                  className="h-20 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                  title={p.name}
                >
                  {p.url ? (
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      ▶ Video
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          loading={submitting}
          disabled={!canSubmit}
          className="w-full py-3"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </Button>

        {!hasLocation && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Pick the location on the map to enable submission.
          </p>
        )}
      </form>
    </div>
  );
}
