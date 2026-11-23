import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200)
});

export const teacherCreateSchema = z.object({
  name: z.string().trim().min(1, "Teacher name is required").max(120, "Name is too long")
});

export const teacherUpdateSchema = z.object({
  name: z.string().trim().min(1, "Teacher name is required").max(120, "Name is too long").optional(),
  isActive: z.boolean().optional()
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
  zebra: z.boolean()
});

export const adminUpdateSchema = z
  .object({
    username: z.string().trim().min(3, "Username must be at least 3 characters").max(100),
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
  year: z.coerce.number().int().min(1900).max(2100)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
export type GenerateQuery = z.infer<typeof generateQuerySchema>;
