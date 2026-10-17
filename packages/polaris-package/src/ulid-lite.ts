/** Tiny ULID-ish id without extra dependency (timestamp + random). */
import { randomBytes } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(): string {
  const time = Date.now();
  let str = "";
  let t = time;
  for (let i = 0; i < 10; i++) {
    str = CROCKFORD[t % 32]! + str;
    t = Math.floor(t / 32);
  }
  const rand = randomBytes(16);
  for (let i = 0; i < 16; i++) {
    str += CROCKFORD[rand[i]! % 32]!;
  }
  return str;
}
