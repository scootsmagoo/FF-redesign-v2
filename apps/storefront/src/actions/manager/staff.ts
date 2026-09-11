import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { AREA_NAMES, isSiteAdmin, requireArea, type Level, type PermissionMap } from '~/lib/manager/permissions';
import { deactivateSalesCode, saveSalesCode } from '~/lib/manager/staff';
import { createOrResetAdmin, deleteRole, getAdminDetail, saveRole, setAdminActive, updateAdmin } from '~/lib/manager-auth';

/** Reads `perm-<Area>` fields from a form post into a permission map; blank = not set (inherit / none). */
function permissionsFromForm(form: Record<string, unknown>): PermissionMap {
  const out: PermissionMap = {};
  for (const area of AREA_NAMES) {
    const v = form[`perm-${area}`];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if ([-1, 0, 1, 2].includes(n)) out[area] = n as Level;
  }
  return out;
}

const bad = (message: string): never => {
  throw new ActionError({ code: 'BAD_REQUEST', message });
};

/** Staff accounts, roles and sales codes (legacy sa_admins / sa_admin_roles / sa_salescodes). */
export const staffActions = {
  /** Creates a staff account, or resets an existing one, and returns the one-time temporary password. */
  createAdmin: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().trim().toLowerCase().min(3).max(120),
      name: z.string().trim().max(80).nullish(),
      roleId: z.number().int().positive().nullish(),
      salesCode: z.string().trim().max(20).nullish(),
    }),
    handler: async ({ email, name, roleId, salesCode }, ctx) => {
      requireArea(ctx, 'Admins', 1);
      try {
        return await createOrResetAdmin(email, name ?? null, { roleId: roleId ?? null, salesCode: salesCode ?? null });
      } catch (e) {
        return bad(e instanceof Error ? e.message : 'Could not create the account');
      }
    },
  }),

  setAdminActive: defineAction({
    accept: 'form',
    input: z.object({ adminId: z.number().int().positive(), active: z.boolean() }),
    handler: async ({ adminId, active }, ctx) => {
      const me = requireArea(ctx, 'Admins', 1);
      if (adminId === me.id) bad('You cannot deactivate your own account. Ask another admin.');
      await setAdminActive(adminId, active);
      return { ok: true };
    },
  }),

  /** Name, role, sales code and per-area overrides. Only a Site Administrator may grant Site Administrator. */
  saveAdmin: defineAction({
    accept: 'form',
    input: z
      .object({
        adminId: z.number().int().positive(),
        name: z.string().trim().max(80).nullish(),
        roleId: z.number().int().nullish(),
        salesCode: z.string().trim().max(20).nullish(),
        useOverrides: z.boolean().default(false),
      })
      .catchall(z.any()),
    handler: async (input, ctx) => {
      const me = requireArea(ctx, 'Admins', 1);
      const target = await getAdminDetail(input.adminId);
      if (!target) bad('Account not found.');
      const roleId = input.roleId && input.roleId > 0 ? input.roleId : null;
      if (input.adminId === me.id && !isSiteAdmin(me) && roleId !== me.roleId) bad('You cannot change your own role.');
      const overrides = input.useOverrides ? permissionsFromForm(input as Record<string, unknown>) : null;
      if (overrides && Object.values(overrides).some((l) => l === 1) && !isSiteAdmin(me)) {
        // non-site-admins may only grant levels they hold themselves
        for (const [area, level] of Object.entries(overrides)) if (level > (me.permissions[area] ?? -1)) bad(`You cannot grant more than your own access to "${area}".`);
      }
      await updateAdmin(input.adminId, { name: input.name ?? null, roleId, salesCode: input.salesCode ?? null, permissions: overrides });
      return { ok: true };
    },
  }),

  saveRole: defineAction({
    accept: 'form',
    input: z.object({ roleId: z.number().int().nullish(), name: z.string().trim().min(1).max(60) }).catchall(z.any()),
    handler: async (input, ctx) => {
      const me = requireArea(ctx, 'Admins', 1);
      if (!isSiteAdmin(me)) bad('Only a Site Administrator can manage roles.');
      try {
        const id = await saveRole({ id: input.roleId ?? null, name: input.name, permissions: permissionsFromForm(input as Record<string, unknown>) });
        return { ok: true, id };
      } catch (e) {
        return bad(e instanceof Error ? e.message : 'Could not save the role');
      }
    },
  }),

  deleteRole: defineAction({
    accept: 'form',
    input: z.object({ roleId: z.number().int().positive() }),
    handler: async ({ roleId }, ctx) => {
      const me = requireArea(ctx, 'Admins', 1);
      if (!isSiteAdmin(me)) bad('Only a Site Administrator can manage roles.');
      try {
        await deleteRole(roleId);
      } catch (e) {
        return bad(e instanceof Error ? e.message : 'Could not delete the role');
      }
      return { ok: true };
    },
  }),

  saveSalesCode: defineAction({
    accept: 'form',
    input: z.object({ id: z.number().int().nullish(), name: z.string().trim().min(1).max(80), code: z.string().trim().min(1).max(20) }),
    handler: async ({ id, name, code }, ctx) => {
      requireArea(ctx, 'Setup', 1);
      try {
        return { ok: true, id: await saveSalesCode({ id: id ?? null, name, code }) };
      } catch (e) {
        return bad(e instanceof Error ? e.message : 'Could not save the sales code');
      }
    },
  }),

  deactivateSalesCode: defineAction({
    accept: 'form',
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }, ctx) => {
      requireArea(ctx, 'Setup', 1);
      await deactivateSalesCode(id);
      return { ok: true };
    },
  }),
};
