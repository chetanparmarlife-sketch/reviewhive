# verify-review-link

Validates a submitted review URL is on Amazon India / Flipkart / Meesho and
is reachable. Best-effort — marketplaces may block the HEAD probe.

Response:

```json
{ "valid": true, "reachable": true, "host": "amazon.in" }
```
or
```json
{ "valid": false, "reason": "URL must be on amazon.in, flipkart.com, or meesho.com" }
```

Deploy: `supabase functions deploy verify-review-link`
