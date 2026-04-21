# apply-to-campaign

Atomically creates an application. The caller's JWT is validated, then the
service-role client runs the availability check + insert in one pass.

Deploy:

```bash
supabase functions deploy apply-to-campaign
```

Call (client):

```ts
await supabase.functions.invoke("apply-to-campaign", {
  body: { campaign_id: "..." },
});
```

Response: `{ application: Application }` or `{ error: string }`.
