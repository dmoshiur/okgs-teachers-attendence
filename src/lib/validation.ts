import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200)
});

export const teacherTypeSchema = z.enum(["teacher", "staff"]);
export const roleSchema = z.enum(["super_admin", "admin"]);

export const includeSchema = z.enum(["all", "teachers", "staff"]);

export const teacherCreateSchema = z.object({
  name: z.string().trim().min(1, "Teacher name is required").max(120, "Name is too long"),
  type: teacherTypeSchema.optional(),
  designation: z.string().trim().max(80, "Designation is too long").optional()
});

export const teacherUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Teacher name is required")
    .max(120, "Name is too long")
    .optional(),
  type: teacherTypeSchema.optional(),
  designation: z.string().trim().max(80, "Designation is too long").optional(),
  isActive: z.boolean().optional()
});

export const teacherBulkSchema = z.object({
  // Blank lines are allowed here and dropped in addTeachersInBulk, so a paste
  // with trailing newlines is not a validation error.
  names: z
    .array(z.string().max(120, "A name is too long"))
    .min(1, "Paste at least one name.")
    .max(1000, "Add at most 1000 names at a time."),
  type: teacherTypeSchema.optional()
});

export const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Nothing to reorder").max(5000)
});

export const settingsSchema = z.object({
  schoolName: z.string().trim().min(1, "School name is required").max(200, "School name is too long"),
  titleTemplate: z
    .string()
    .trim()
    .min(1, "Title template is required")
    .max(300, "Title template is too long"),
  fillEmptySlots: z.boolean(),
  zebra: z.boolean(),
  showDesignation: z.boolean()
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(100, "Username is too long")
  .refine((value) => !/\s/.test(value), "Usernames cannot contain spaces");

export const userCreateSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(120, "Display name is too long").optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: roleSchema
});

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(120).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional()
});

export const userPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200)
});

export const accountProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(120)
});

export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(200),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(200, "Password is too long")
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "The new password must be different from the current password",
    path: ["newPassword"]
  });

export const generateQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1900).max(2100),
  include: includeSchema.optional()
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;
export type TeacherBulkInput = z.infer<typeof teacherBulkSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type AccountPasswordInput = z.infer<typeof accountPasswordSchema>;
export type GenerateQuery = z.infer<typeof generateQuerySchema>;
export type IncludeFilter = z.infer<typeof includeSchema>;
