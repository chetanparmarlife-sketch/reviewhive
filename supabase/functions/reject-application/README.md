# reject-application

Admin-only. Body: `{ application_id, reason, stage }`. Stage is either
`application` (→ status `rejected`) or `submission` (→
`rejected_submission`).

Deploy: `supabase functions deploy reject-application`
