# Environment Setup

SimpliCare mobile uses local environment variables for Supabase auth. Never commit secrets.

## 1. Create your local env file

From `apps/mobile`:

```bash
cp .env.example .env
```

## 2. Add Supabase values to `.env`

Set:

```bash
SUPABASE_URL=your-project-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use the Supabase **publishable/anon** key only. Do not use the secret key in mobile.

## 3. Restart Expo

After changing `.env`, restart Expo so config reloads:

```bash
npx expo start -c
```

## 4. Avatar storage bucket setup

Create a Supabase Storage bucket named `avatars` (all lowercase).

- Recommended: private bucket with signed URLs.
- Path convention used by the app: `<userId>/avatar.jpg`
- If you enforce MIME allowlists in bucket settings, include:
  - `image/jpeg`
  - `image/png`
  - `image/heic`
  - `image/heif`
