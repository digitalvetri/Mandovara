// Types for pdf-actions.ts — must live outside the "use server" file
// (a "use server" file may only export async functions).

export interface PdfActionResult {
  ok: boolean;
  error?: string;
}
