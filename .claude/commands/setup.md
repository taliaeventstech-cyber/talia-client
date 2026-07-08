Set up the project from scratch:

1. `npm install`
2. Verify that .env.local exists with the Supabase variables
3. `npx supabase start` (local Supabase)
4. `npm run db:migrate` (apply migrations)
5. `npm run db:types` (generate types)
6. `npm run dev` (start)

If any environment variable is missing, let me know.