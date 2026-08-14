// Zod schemas for the employees module.

import { z } from "zod";

// UI exposes extended labels; DB stores only ACTIVE|SUSPENDED (UserStatus enum).
// Actions map ON_LEAVE/RESIGNED/TERMINATED → SUSPENDED at write time.
export const EMPLOYEE_STATUSES = ["ACTIVE", "SUSPENDED", "ON_LEAVE", "RESIGNED", "TERMINATED"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

const mobileRegex = /^(\+91)?\d{10}$/;
const panRegex    = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const isoDate     = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const createEmployeeSchema = z.object({
  name:         z.string().trim().min(2).max(120),
  mobile:       z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  email:        z.string().trim().email().optional().or(z.literal("")),
  code:         z.string().trim().max(20).optional().or(z.literal("")),
  designation:  z.string().trim().max(80).optional().or(z.literal("")),
  department:   z.string().trim().max(60).optional().or(z.literal("")),
  branchId:     z.string().min(1, "Pick a branch"),
  joinDate:     isoDate,
  panNumber:    z.string().trim().regex(panRegex, "10-char PAN").optional().or(z.literal("")),
});

export const deleteEmployeeSchema = z.object({
  id: z.string().min(1),
});

export const setEmployeeStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(EMPLOYEE_STATUSES),
  exitDate: isoDate.optional().or(z.literal("")),
});

export type CreateEmployeeInput   = z.infer<typeof createEmployeeSchema>;
export type SetEmployeeStatusInput = z.infer<typeof setEmployeeStatusSchema>;
