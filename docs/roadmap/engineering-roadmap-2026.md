# Engineering Roadmap (2026)

## Q1: Reliability Foundation

- Land structured API observability and client telemetry
- Enforce contract tests in CI for creator flow
- Publish KPI/SLO scorecard and weekly review cadence

Success criteria:

- SLO measured weekly
- 0 unknown-severity incidents

## Q2: Security Hardening

- Add optional domain reputation checks for image hosts
- Add automated env validation check for production secrets
- Run quarterly threat-model review

Success criteria:

- No plaintext secrets in KV
- All required production security env vars validated on deploy

## Q3: Product Throughput

- Further separate domain logic from page UI modules
- Add small integration test harness for recipient flow regressions
- Improve creator UX for failed image links

Success criteria:

- Reduced change lead time for `/create`
- lower image failure support issues

## Q4: Scale + Operability

- Evaluate image proxy/CDN mode
- Add on-call quality bar (runbooks, drill logs, ownership map)
- Add release dashboards and trend reporting

Success criteria:

- Predictable deploy safety
- measurable drop in production incident MTTR
