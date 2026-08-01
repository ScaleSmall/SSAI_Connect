
# SSAI Connect

Client-facing connection setup app for Scale Small AI integrations.

## Production Configuration

The app must receive Supabase browser config from the build environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not hardcode Supabase keys in source. Keep local values in ignored `.env` files and keep `.env.example` as the non-secret template.

## Validation

Run the full release gate before shipping:

```bash
npm run check
```

The gate verifies the Connect cloud contract, committed-secret scan, dependency audit, package signatures, production build, and clean release hygiene.

`npm run check` requires real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values in the environment. The anon key must be the browser-safe Supabase `anon` role key for the configured project, not a service-role key and not a placeholder.

`npm run build` also runs the env verifier first so GitHub or Cloudflare auto-deploy cannot publish a Connect bundle with missing Supabase browser config.

## TikTok Direct Post readiness

TikTok uses the request-bound OAuth completion relay shared by the other supported providers. After a tenant has a non-expired OAuth connection with refresh access and a TikTok creator identifier, Connect can make an authenticated, read-only `creator_info` request to show the connected creator and provider-reported publishing capabilities.

This UI does not expose or alter the server-side Direct Post gates, does not publish content, and does not treat static validation as activation. A real publish must still pass the protected server-side audited-client controls and collect the current creator confirmation, consent, privacy and interaction choices, disclosures, and media validation for that individual post.
