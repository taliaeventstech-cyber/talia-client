 Create a complete feature following TALIA's standard pattern:

1. Create the migration in /supabase/migrations/ with multi-tenant RLS
2. Apply the migration and regenerate types with npm run db:types
3. Create the types in /src/types/ with zod validation
4. Create the server action in the feature folder
5. Create the page (Server Component) in /src/app/(dashboard)/[tenantId]/
6. Create the UI component with shadcn in /src/components/dashboard/
7. Add a co-located test
8. Update the sidebar nav
9. Verify it passes lint and typecheck

Follow the `supabase-rls` (migrations + RLS) and `dashboard-component` (page/form/action/component) skills of the project — they are in `.claude/skills/`.