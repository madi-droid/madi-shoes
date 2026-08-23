# MADIYAR SHOES

The production storefront is the static application in the repository root.
The `фигма/` Vite project is a separate design prototype and is deliberately
not included in the GitHub Pages deployment artifact.

Employees access the back office only through `staff.html`; the storefront
contains no link or shortcut to the staff sign-in screen.

## Secure Supabase rollout

1. Apply the SQL files in `supabase/migrations/` in numerical order. They are
   the only source of truth for the database schema.
2. Before staff sign in, reset every existing staff password in Supabase SQL
   Editor. Use a unique 8–64 character password containing Latin letters and
   digits and execute this once per employee:

   ```sql
   update public.profiles
   set pin_hash = crypt('REPLACE_WITH_A_NEW_PIN', gen_salt('bf', 12))
   where phone = '7XXXXXXXXXX';
   ```

3. Confirm that direct table access for `anon` is denied and test: a public
   catalogue read, a reservation, a staff login, a sale and a cancelled
   reservation. The migration preserves the existing product catalogue but
   intentionally invalidates legacy client-side PIN hashes.

## Quality checks

Run `npm run build` inside `фигма/` for the prototype. The root application is
plain browser JavaScript; run `node --check js/*.js` before publishing changes.
