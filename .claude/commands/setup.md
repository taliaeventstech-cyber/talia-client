Configura el proyecto desde cero:

1. `npm install`
2. Verifica que existe .env.local con las variables de Supabase
3. `npx supabase start` (Supabase local)
4. `npm run db:migrate` (aplicar migrations)
5. `npm run db:types` (generar tipos)
6. `npm run dev` (arrancar)

Si falta alguna variable de entorno, indícamelo.