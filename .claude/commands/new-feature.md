 Crea una feature completa siguiendo el patrón estándar de TALIA:

1. Crea la migration en /supabase/migrations/ con RLS multi-tenant
2. Aplica la migration y regenera tipos con npm run db:types
3. Crea los tipos en /src/types/ con validación zod
4. Crea la server action en la carpeta de la feature
5. Crea la page (Server Component) en /src/app/(dashboard)/[tenantId]/
6. Crea el componente UI con shadcn en /src/components/dashboard/
7. Añade test co-locado
8. Actualiza el sidebar nav
9. Verifica que pasa lint y typecheck

Sigue las skills `new-feature`, `supabase-rls` y `dashboard-component` del proyecto.