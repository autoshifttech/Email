import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { errMsg } from "./auth";

export type Ctx<T extends string = "id"> = { params: Promise<Record<T, string>> };

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json);
}

/** Wrap a handler: converts thrown errors into JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return NextResponse.json({ error: `${first.path.join(".") || "input"}: ${first.message}` }, { status: 400 });
      }
      const status = (e as { status?: number }).status;
      return NextResponse.json({ error: errMsg(e) }, { status: status && status >= 400 && status < 600 ? status : 500 });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
