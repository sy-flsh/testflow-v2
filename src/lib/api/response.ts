import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiError(message: string, status = 500, code?: string) {
  return NextResponse.json(
    {
      error: {
        message,
        ...(code ? { code } : {}),
      },
    },
    { status },
  );
}
