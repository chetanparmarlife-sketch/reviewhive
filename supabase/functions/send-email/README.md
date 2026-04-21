# send-email

Sends transactional email via [Resend](https://resend.com). Templates:
`welcome`, `application-approved`, `application-rejected`, `payout-sent`,
`campaign-reminder`.

Required env:
- `RESEND_API_KEY`
- `EMAIL_FROM` (optional, defaults to `ReviewHive <no-reply@reviewhive.in>`)

Set via:

```bash
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM='ReviewHive <no-reply@reviewhive.in>'
```

Deploy: `supabase functions deploy send-email`

Called only by other Edge Functions (service-role bearer) or by authenticated
admins — end users may not invoke directly.
