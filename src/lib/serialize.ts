import type { AiProvider, EmailAccount } from "@prisma/client";

/** Never send encrypted secrets to the browser. */
export function publicAccount(a: EmailAccount) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encPassword, ...rest } = a;
  return { ...rest, hasPassword: !!encPassword };
}
export type PublicAccount = ReturnType<typeof publicAccount>;

export function publicProvider(p: AiProvider) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encApiKey, ...rest } = p;
  return { ...rest, hasKey: !!encApiKey };
}
export type PublicProvider = ReturnType<typeof publicProvider>;
