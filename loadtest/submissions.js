import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for guestbook-specific tracking
const submissionErrors = new Counter('submission_errors');
const submissionRate = new Rate('submission_success_rate');
const submissionDuration = new Trend('submission_duration', true);

// Configuration: 500 concurrent VUs ramping over 60 seconds
// Mirrors the live talk scenario: QR code displayed, audience floods in
export const options = {
  scenarios: {
    burst_submissions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },   // Ramp to 500 VUs over 10 seconds
        { duration: '50s', target: 500 },   // Hold 500 VUs for 50 seconds
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],           // Less than 1% request failure rate
    http_req_duration: ['p(95)<500'],          // 95th percentile response time < 500ms
    submission_success_rate: ['rate>0.99'],    // 99%+ submissions succeed
  },
};

// Base URL -- override with: k6 run -e BASE_URL=https://guestbook.example.com loadtest/submissions.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Sample country codes for realistic distribution
const COUNTRIES = ['DE', 'US', 'GB', 'FR', 'JP', 'AU', 'CA', 'BR', 'IN', 'KR',
                   'NL', 'SE', 'NO', 'FI', 'CH', 'AT', 'ES', 'IT', 'PL', 'CZ'];

export default function () {
  // Each VU submits with a unique name (VU ID + iteration ensures uniqueness)
  const payload = JSON.stringify({
    name: `K6-VU${__VU}-${__ITER}`,
    country_code: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
    homelab_level: Math.ceil(Math.random() * 5),
  });

  const res = http.post(`${BASE_URL}/api/submissions`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'submit' },
  });

  // Track custom metrics
  submissionDuration.add(res.timings.duration);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'response has id': (r) => {
      try {
        return JSON.parse(r.body).id > 0;
      } catch (e) {
        return false;
      }
    },
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) {
    submissionErrors.add(1);
    submissionRate.add(false);
  } else {
    submissionRate.add(true);
  }

  // Small think time to avoid pure burst -- real users have slight delays
  sleep(0.1 + Math.random() * 0.2);
}

// Setup: verify the server is reachable before starting load
export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'server is healthy': (r) => r.status === 200,
  });
  if (healthRes.status !== 200) {
    throw new Error(`Server not healthy at ${BASE_URL}/api/health -- got status ${healthRes.status}`);
  }
  console.log(`Load test targeting: ${BASE_URL}`);
  return { baseUrl: BASE_URL };
}
