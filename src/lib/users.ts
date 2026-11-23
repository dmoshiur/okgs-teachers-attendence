import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { ensureReady } from "./db";
import { admins, type Admin, type AdminRole } from "./schema";
import { hashPassword, isSuperAdmin, verifyPassword } from "./auth";

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: number;
};

export class UserError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toPublic(admin: Admin): PublicUser {
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName || admin.username,
    role: admin.role,
    isActive: admin.isActive,
    createdAt: admin.createdAt
  };
}

/** Usernames are unique ignoring case, so `Admin` and `admin` collide. */
function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export async function listUsers(): Promise<PublicUser[]> {
  const db = await ensureReady();
  const rows = await db.select().from(admins).orderBy(asc(admins.id));
  return rows.map(toPublic);
}

async function findByUsername(db: Awaited<ReturnType<typeof ensureReady>>, username: string) {
  return db
    .select()
    .from(admins)
    .where(sql`lower(${admins.username}) = ${normalizeUsername(username)}`)
    .get();
}

export async function countActiveSuperAdmins(excludeId?: number): Promise<number> {
  const db = await ensureReady();
  const condition =
    excludeId === undefined
      ? sql`${admins.role} = 'super_admin' AND ${admins.isActive} = 1`
      : sql`${admins.role} = 'super_admin' AND ${admins.isActive} = 1 AND ${admins.id} <> ${excludeId}`;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(admins).where(condition);
  return Number(rows[0]?.count ?? 0);
}

export type CreateUserInput = {
  username: string;
  displayName?: string;
  password: string;
  role: AdminRole;
};

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const db = await ensureReady();
  const username = normalizeUsername(input.username);

  if (await findByUsername(db, username)) {
    throw new UserError("That username is already taken.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(admins)
    .values({
      username,
      passwordHash,
      displayName: input.displayName?.trim() || username,
      role: input.role,
      isActive: true,
      createdAt: Math.floor(Date.now() / 1000)
    })
    .returning();

  if (!created) throw new UserError("Could not create the user.", 500);
  return toPublic(created);
}

export type UpdateUserInput = {
  displayName?: string;
  role?: AdminRole;
  isActive?: boolean;
};

/**
 * Editing another account. Blocks the two ways an installation can lock
 * itself out: touching your own account from the Users page, and removing the
 * last active super admin.
 */
export async function updateUser(
  id: number,
  input: UpdateUserInput,
  actor: Admin
): Promise<PublicUser> {
  const db = await ensureReady();
  const target = await db.select().from(admins).where(eq(admins.id, id)).get();
  if (!target) throw new UserError("User not found.", 404);

  if (target.id === actor.id) {
    throw new UserError("You cannot change your own account here. Use My account.", 400);
  }

  const nextRole = input.role ?? target.role;
  const nextActive = input.isActive ?? target.isActive;
  const losesSuperAdmin = isSuperAdmin(target.role) && (!isSuperAdmin(nextRole) || !nextActive);

  if (losesSuperAdmin && (await countActiveSuperAdmins(target.id)) === 0) {
    throw new UserError(
      "That is the last active super admin. Promote someone else before demoting or deactivating them.",
      400
    );
  }

  const [updated] = await db
    .update(admins)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    })
    .where(eq(admins.id, id))
    .returning();

  if (!updated) throw new UserError("User not found.", 404);
  return toPublic(updated);
}

export async function setUserPassword(id: number, password: string): Promise<void> {
  const db = await ensureReady();
  const passwordHash = await hashPassword(password);
  const updated = await db
    .update(admins)
    .set({ passwordHash })
    .where(eq(admins.id, id))
    .returning({ id: admins.id });
  if (updated.length === 0) throw new UserError("User not found.", 404);
}

export async function deleteUser(id: number, actor: Admin): Promise<void> {
  const db = await ensureReady();
  const target = await db.select().from(admins).where(eq(admins.id, id)).get();
  if (!target) throw new UserError("User not found.", 404);

  if (target.id === actor.id) {
    throw new UserError("You cannot delete your own account.", 400);
  }

  if (isSuperAdmin(target.role) && target.isActive && (await countActiveSuperAdmins(id)) === 0) {
    throw new UserError("That is the last active super admin and cannot be deleted.", 400);
  }

  await db.delete(admins).where(eq(admins.id, id));
}

export type OwnAccountInput = {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
};

/**
 * The signed-in user editing themselves. Changing the password always requires
 * the current one, so a stolen session cannot silently take over an account.
 */
export async function updateOwnAccount(user: Admin, input: OwnAccountInput): Promise<PublicUser> {
  const db = await ensureReady();

  if (input.displayName !== undefined && input.displayName.trim().length === 0) {
    throw new UserError("Display name cannot be empty.");
  }

  if (input.newPassword !== undefined) {
    if (!input.currentPassword) {
      throw new UserError("Enter your current password to set a new one.");
    }
    const matches = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!matches) throw new UserError("Current password is incorrect.", 401);
  }

  const [updated] = await db
    .update(admins)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
      ...(input.newPassword !== undefined
        ? { passwordHash: await hashPassword(input.newPassword) }
        : {})
    })
    .where(eq(admins.id, user.id))
    .returning();

  if (!updated) throw new UserError("Account not found.", 404);
  return toPublic(updated);
}
