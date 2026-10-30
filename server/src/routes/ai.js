import { Router } from 'express';
import { upload, saveLocalFile } from '../utils/upload.js';
import { authenticate } from '../middleware/auth.js';
import { wrapRouter } from '../utils/asyncHandler.js';

const router = wrapRouter(Router());

/**
 * Single-image object detection.
 *
 * Prefers the project's own Python service (PYTHON_AI_URL); falls back to an
 * external YOLOv8 endpoint (YOLOV8_API_URL) and finally to a demo response so
 * the page is still demonstrable with nothing configured.
 */
router.post('/detect', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file required' });
  }

  const pythonUrl = process.env.PYTHON_AI_URL;
  const apiUrl = process.env.YOLOV8_API_URL;
  const apiKey = process.env.YOLOV8_API_KEY;

  if (!pythonUrl && !apiUrl) {
    return res.json({
      mode: 'demo',
      message:
        'No inference service configured. Set PYTHON_AI_URL (bundled Flask service) or YOLOV8_API_URL.',
      detections: [
        { label: 'person', confidence: 0.42 },
        { label: 'backpack', confidence: 0.31 },
      ],
      imageUrl: null,
    });
  }

  const target = pythonUrl
    ? `${pythonUrl.replace(/\/+$/, '')}/detect`
    : apiUrl;

  try {
    const form = new FormData();
    form.append(
      'file',
      new Blob([req.file.buffer], { type: req.file.mimetype || 'image/jpeg' }),
      req.file.originalname || 'image.jpg'
    );

    const headers = {};
    if (!pythonUrl && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(target, {
      method: 'POST',
      body: form,
      headers,
      signal: AbortSignal.timeout(
        Number(process.env.PYTHON_AI_TIMEOUT_MS) || 30000
      ),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        message: 'Detection service error',
        detail: text.slice(0, 500),
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { raw: await response.text() };

    // Best-effort: keep a copy of the analysed image for the results panel.
    let imageUrl = null;
    try {
      imageUrl = await saveLocalFile(req.file.buffer, req.file.originalname);
    } catch (err) {
      console.error('AI image copy failed', err);
    }

    return res.json({ mode: 'live', ...data, imageUrl });
  } catch (err) {
    return res.status(502).json({
      message: 'Detection request failed',
      detail: err?.message,
    });
  }
});

export default router;
