# Release Checklist and Rollback Plan

## Pre-Deploy (Staging Smoke)

1. `npm run build`
2. `npm run test:run`
3. `npm run test:contract`
4. Manual smoke:
   - `/create` loads and theme chips show distinct colors
   - create page submission succeeds with challenge
   - recipient flow allows exactly 3 picks
   - results page loads with valid key
5. Security smoke:
   - challenge endpoint returns token
   - invalid challenge returns 403
   - CSP violations are logged via telemetry endpoint

## Production Deploy Gate

1. Required env vars present (`UPSTASH_*`, `APP_BASE_URL`, challenge secret, healthcheck token, encryption key)
2. Latest CI green on `main`
3. Rollback owner identified for this deploy window

## Post-Deploy Checks (10 minutes)

1. Hit `/create` and submit test payload
2. Verify one successful `create.success` and `submit.success` log entry
3. Confirm no elevated `challenge_failed` or `csp_violation_client` spikes

## Rollback Plan

1. Roll back to previous Vercel deployment version.
2. Re-run post-deploy checks against rolled-back build.
3. Open incident note with:
   - start time
   - impact summary
   - root-cause hypothesis
   - fix-forward owner
