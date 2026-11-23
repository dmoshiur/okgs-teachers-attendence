export function firstIssue(error: { issues: ReadonlyArray<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Invalid input";
}
