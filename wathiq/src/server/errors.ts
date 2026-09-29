export class AppError extends Error {
  constructor(
    readonly code: "not_found" | "forbidden" | "invalid" | "unauthenticated",
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export const notFound = (what = "resource") => new AppError("not_found", `${what} not found`, 404);
export const forbidden = (why = "forbidden") => new AppError("forbidden", why, 403);
export const invalid = (why: string) => new AppError("invalid", why, 400);
export const unauthenticated = () => new AppError("unauthenticated", "sign in required", 401);
