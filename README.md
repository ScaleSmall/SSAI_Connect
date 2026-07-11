
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
