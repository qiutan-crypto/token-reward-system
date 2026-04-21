# Token Reward System - Setup Guide

## Supabase Configuration

Project URL: `https://xoxfkcgdvrygcoqmmvbf.supabase.co`

## Environment Variables

Create a `.env.local` file in the project root with:

```
NEXT_PUBLIC_SUPABASE_URL=https://xoxfkcgdvrygcoqmmvbf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveGZrY2dkdnJ5Z2NvcW1tdmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzYyNTgsImV4cCI6MjA5MjMxMjI1OH0.uKXgZGLEI2tDPM0jxYOSWo3vvDXCfJyq69wDdXjcNUQ
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase Dashboard > Settings > API Keys>
```

## Vercel Deployment

1. Connect your GitHub repo to Vercel
2. Add all environment variables in Vercel Dashboard > Project > Settings > Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy!

## Database Setup

The database has already been set up via Supabase SQL Editor.
If you need to reset, run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.

## User Accounts

Create accounts manually via Supabase Dashboard > Authentication > Users:
- **Parent account**: Set role = 'parent' in the profiles table
- **Kid account**: Set role = 'kid' in the profiles table

Or use the signup flow at `/login` and set the role metadata:
- Parent: `{ "name": "Parent Name", "role": "parent" }`
- Kid: `{ "name": "Kid Name", "role": "kid" }`

## App URLs

- `/` - Home (redirects based on role)
- `/login` - Login / Signup
- `/parent/dashboard` - Parent dashboard
- `/parent/award` - Award tokens to kids
- `/parent/behaviors` - Manage behavior rules
- `/parent/rewards` - Manage prize catalog
- `/parent/reports` - Monthly reports
- `/kid` - Kid home with balance
- `/kid/store` - Prize store
- `/kid/history` - Token history
