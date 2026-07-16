import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// -----------------------------------------------------------------------------
//  Access model (RBAC — app-level enforcement)
//
//  profiles.role: 'admin' (global superuser) | 'member'.
//  program_memberships: per-program role 'mo' | 'user' for members.
//
//  - Admin: sees & does everything, across all programs.
//  - MO of P: sees/adds in P; can assign Users to P.
//  - User of P: sees/adds in P.
//  - Member with no memberships: pending (no access).
//
//  This helper is the ONE place access is derived; pages and server actions
//  consume it so the rules stay consistent.
// -----------------------------------------------------------------------------

export type MembershipRole = "mo" | "user";
export type Membership = { program: string; role: MembershipRole };

export type Access = {
  userId: string | null;
  isAdmin: boolean;
  memberships: Membership[];
  /** Programs the user may see (all programs ⇒ handled via isAdmin). */
  visiblePrograms: string[];
  /** Programs where the user is an MO (may assign Users). */
  moPrograms: string[];
  /** Signed in, not admin, and assigned to no program yet. */
  isPending: boolean;
};

// Wrapped in React cache so repeated calls within one render (layout + pages +
// queries all ask for it) hit the DB just once.
export const getMyAccess = cache(async function getMyAccess(): Promise<Access> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      isAdmin: false,
      memberships: [],
      visiblePrograms: [],
      moPrograms: [],
      isPending: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  const { data: mem } = await supabase
    .from("program_memberships")
    .select("program, role")
    .eq("profile_id", user.id);
  const memberships = (mem ?? []) as Membership[];

  const visiblePrograms = memberships.map((m) => m.program);
  const moPrograms = memberships.filter((m) => m.role === "mo").map((m) => m.program);

  return {
    userId: user.id,
    isAdmin,
    memberships,
    visiblePrograms,
    moPrograms,
    isPending: !isAdmin && memberships.length === 0,
  };
});

// Can this access see items belonging to `program`? (null program ⇒ admin-only)
export function canSeeProgram(access: Access, program: string | null): boolean {
  if (access.isAdmin) return true;
  if (!program) return false;
  return access.visiblePrograms.includes(program);
}

// Can this access add/act within `program`?
export function canActInProgram(access: Access, program: string | null): boolean {
  if (access.isAdmin) return true;
  if (!program) return false;
  return access.visiblePrograms.includes(program);
}

// Which programs may this access assign Users to? (admin: all — resolved by caller)
export function canManageUsersFor(access: Access, program: string): boolean {
  return access.isAdmin || access.moPrograms.includes(program);
}
