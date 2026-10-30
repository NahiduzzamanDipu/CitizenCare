# CitizenCare — Test Cases

Project: CitizenCare (Smart Public Safety & Crime Alert System)  
Date: 2026-04-27

## Test Case 01 — API Health Check

- **Objective**: Verify backend is running and reachable.
- **Module**: Backend (Node.js + Express)
- **Endpoint**: `GET /api/health`
- **Preconditions**:
  - Backend started with `npm run dev`
  - API running on `http://localhost:5000`

### Test steps
1. Send a request to the health endpoint.

### Test data
- N/A

### Expected output
- HTTP Status: `200 OK`
- Body contains: `{ ok: true, time: <ISO timestamp> }`

### Actual output (example)
- **Actual status**: `200 OK`
- **Actual response body**:

```json
{
  "ok": true,
  "time": "2026-04-27T08:48:12.413Z"
}
```

### Status
- **PASS**

