# CitizenCare (CCTV + AI + Safety Map) — Viva Notes (বাংলা)

## 1) সিস্টেমটা কী করে (High level)
- **Citizen Portal**: ম্যাপ দেখে সেফ/রিস্ক, লাইভ অ্যালার্ট, রিপোর্ট সাবমিট।
- **Police Portal**: লাইভ CCTV ফিড, AI ডিটেকশন অ্যালার্ট, ইনসিডেন্ট ম্যানেজ।
- **Backend (Node/Express + MongoDB)**: Auth/JWT, রিপোর্ট স্টোর, CCTV ইভেন্ট স্টোর, Socket.io রিয়েল-টাইম ব্রডকাস্ট।
- **AI Service (Python Flask + YOLOv8)**: ছবি/ফ্রেম নিয়ে ডিটেকশন করে বক্স/লেবেল/কনফিডেন্স ফেরত দেয়।

## 2) লাইভ CCTV + AI ফ্লো (Step-by-step)
1. ব্রাউজার থেকে `getUserMedia()` দিয়ে ক্যামেরা স্ট্রিম নেয় (এখানে **Camo Studio virtual camera** সিলেক্ট করা যায়)  
   - ফাইল: `client/src/cctv-module/CCTVPage.jsx`
2. `<video>` এ লাইভ ভিডিও দেখায়, hidden `<canvas>` দিয়ে প্রতি ~1 সেকেন্ডে ফ্রেম নেয়  
3. ফ্রেম JPEG হিসেবে `multipart/form-data` দিয়ে Node API তে পাঠায়  
   - Endpoint: `POST /api/cctv/upload-frame`  
   - ফাইল: `server/src/routes/cctv.js`
4. Node ওই ফ্রেম Python AI সার্ভিসে forward করে  
   - Python endpoint: `POST /detect`  
   - ফাইল: `ai-model/app.py`
5. Python YOLO predict করে: `detections[]`, `weaponDetected`, `weaponLabels` রিটার্ন করে  
6. Node ফলাফল পেলে:
   - **Socket.io** দিয়ে `cctv-alert` (police/staff) ইভেন্ট পাঠায়
   - MongoDB তে `CctvEvent` সেভ করে  
7. Frontend CCTV পেজে বক্স overlay করে, `Weapon Detected` / `No Threat Detected` দেখায়  

## 3) YOLO ডিটেকশন কেন কখনও “No detections” দেখায় (COCO limitation)
- ডিফল্ট `yolov8n.pt` (COCO) এ **gun/firearm reliable না**; `knife` কিছুটা detect হতে পারে।
- তাই:
  - Demo: person + knife/scissors/bat → “Possible Weapon” heuristic
  - Real: custom weapon dataset দিয়ে train করা `.pt` ব্যবহার

## 4) Citizen Safety Suggestion (AI-based risk score)
### Data source
- **Crime reports**: `CrimeReport` (verified)  
  - ফাইল: `server/src/models/CrimeReport.js`
- **Weapon detections**: `CctvEvent`  
  - ফাইল: `server/src/models/CctvEvent.js`

### API
- `GET /api/safety-status?lat=...&lng=...&radiusM=1000&days=14`  
  - ফাইল: `server/src/routes/safety.js`

### Logic (Viva explain)
- Radius এর মধ্যে last N days এর:
  - recentCrimes (×2)
  - weaponDetections (×3)
- **riskScore** = (crimes*2) + (weapons*3)
- status:
  - 0 → SAFE
  - <5 → LOW RISK
  - ≥5 → HIGH RISK
- Night heuristic: রাত হলে risk note দেখায়

### UI
- Citizen map এ উপরে একটি card:
  - Green/Yellow/Red
  - “Based on recent activity”
  - map এ click করলে ওই point analyse হয়  
  - ফাইল: `client/src/citizen/CitizenMap.jsx`

## 5) Google Maps + Real-time update
- Map component: `@react-google-maps/api`
- Police live map: `client/src/pages/LiveMap.jsx`
  - `/api/reports/map` (verified incidents) + `/api/cctv/map` (weapon markers)
  - Socket event: `cctv-alert` → live red marker add
- Citizen map: `/api/cctv/public-map` + `/api/reports/map`

## 6) Socket.io ইভেন্টগুলো
- Server setup: `server/src/index.js`
- Events:
  - `cctv-alert` (weapon/suspicious) → police dashboard + (user channel)
  - `cctv-status` / `cctv-frame` (live preview/status)
  - `public-safety` (citizen map refresh trigger)
- Client socket: `client/src/context/SocketContext.jsx`

## 7) “Open Map / Report” + Live Alerts UI (Citizen)
- Shell + Tabs: `client/src/citizen/CitizenApp.jsx`
- Safety tab এ:
  - `Open Map` + `Report` বাটন **Live Alerts এর আগে**
  - Live Alerts rows এ location name + SAFE/DANGEROUS badge

## 8) Viva প্রশ্ন–উত্তর (খুব সংক্ষেপ)
- **Q: AI কোথায় চলে?**  
  A: Python Flask (`ai-model/app.py`) এ YOLO predict। Node শুধু forward + store + socket broadcast।
- **Q: ১ FPS কেন?**  
  A: latency/CPU balance; CCTV realtime + cost কম।
- **Q: Gun detect হয় না কেন?**  
  A: COCO class limitation; custom-trained weights দরকার।
- **Q: Safety-score “AI” কেন বলছেন?**  
  A: এটা explainable rule-based scoring (data-driven), viva তে সহজ।

## 9) Improve করার আইডিয়া (Next)
- **True Geo index for `CctvEvent`** (GeoJSON Point + 2dsphere index) → faster radius query
- **Caching** safety-status (lat/lng grid ভিত্তিক) → API দ্রুত
- **Real ML**: logistic regression / time-series model (night/day, crime types weight, decay)
- **Better weapon model**: custom dataset + quantized model + GPU inference
- **Privacy**: citizen public-map এ rounding/aggregation (heatmap) + rate limit

## 10) Challenges (বাস্তব সমস্যা)
- Google Maps: billing, key restriction, API enable
- CCTV: permission, virtual camera selection, lighting/blur
- Model limitation: COCO vs custom
- Realtime scaling: Socket.io rooms, payload size (base64 frame)
- Data quality: fake reports, sparse data → “No data” fallback দরকার

