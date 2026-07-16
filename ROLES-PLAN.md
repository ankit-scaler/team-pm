# Roles & Program Scoping — Implementation Plan

## Decisions (confirmed)
- **Multiple programs per person.**
- **App-level enforcement** (queries filter + server-action guards). No Postgres RLS changes now — lower risk on the production DB.
- **Assign-after-login**: a new Google login lands in a *pending* state (no access) until an Admin/MO assigns them.
- **Admin analytics = People productivity** (per person, viewable program-wise).

## Model
`profiles.role` stays **`admin` | `member`** (admin = global superuser). Everyone else is a `member` whose actual powers come from per-program memberships:

**New table `program_memberships`** — `(profile_id, program, role)`, role ∈ `mo` | `user`, PK `(profile_id, program)`.

This cleanly supports a person being **MO of Academy _and_ User of DevOps**, etc.

| Capability | Admin | MO (of program P) | User (of program P) |
|---|---|---|---|
| See tasks/adhoc/topics | All programs | Program P | Program P |
| Add task/adhoc | Any program | Program P | Program P |
| Edit/complete/delete items | Any | In P | In P |
| Assign **Users** to a program | Any program | **P only** | ❌ |
| Assign **MOs** to a program | ✅ | ❌ | ❌ |
| People-productivity dashboard | ✅ (all, program-wise) | ❌ | ❌ |

- A `member` with **no memberships** = *pending* → sees a "ask an admin to add you" screen, no data.
- Items with **no program** are visible to **admins only** (encourage setting a program).

## Work breakdown

### Phase 1 — Model & access core
- Migration `v11`: create `program_memberships` (+ read/write policies, consistent with the app's existing authenticated-write model).
- Bootstrap: ensure **you are `admin`**; seed memberships for current active people **from their existing task programs** so nobody loses access at cutover.
- `lib/access.ts`: `getMyAccess()` → `{ isAdmin, memberships, visiblePrograms, isMOof(p), addableablePrograms }`.

### Phase 2 — Management UI (before enforcing, so no lockouts)
- **Admin → Team/Access tab**: list everyone; per person assign memberships (program + mo/user), toggle admin, remove.
- **MO management**: add/remove **Users** within their own program(s) only — cannot create MOs/admins or touch other programs.

### Phase 3 — Turn on scoping
- Filter `getTasks` / `getAdhocRequests` / `getPeople` / Board / Tasks / Adhoc / KRs to the caller's `visiblePrograms` (admin = all).
- Guard server actions (`createTask`, `updateTask`, `changeStatus`, `deleteTask`, adhoc equivalents): the item's program must be in the caller's allowed set; program chosen on create must be allowed.
- Program dropdowns limited to the caller's programs (admin: all).
- **Pending** state screen for members with no memberships.

### Phase 4 — Admin analytics (People productivity)
- New **`/insights`** page (admin-only; admin-only nav item), filterable by program:
  - Picked vs Completed per person (bar)
  - Completion rate (donut/meter)
  - Avg time-to-complete (`picked_date` → `delivered_date`)
  - Overdue count per person
  - Adhoc raised/handled per person
- Data: `tasks` + `task_status_history` + `adhoc_requests` + `program_memberships`.
- Charts built as **lightweight inline SVG/CSS** (no heavy dependency), following a consistent palette.

## Rollout safety
- App-level only ⇒ no RLS change ⇒ current login/reads can't break.
- Seed memberships from existing task data first ⇒ nobody loses access on cutover.
- Ship Phases 1–2 (assign everyone) **before** Phase 3 (enforce).

## Assumptions to confirm
1. **Role is global + program-scoped membership** (a person can be MO of one program and User of another). ✅ per "multiple programs".
2. **"Topics" = tasks** (the app has no separate topics entity).
3. **Within a program, all members can edit/complete/delete that program's items** (collaborative within program), matching today's behavior — just scoped.
4. **KRs**: leave global for now, scope in a later pass (flag).
