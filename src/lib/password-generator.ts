// Works both on the server and in the browser (Web Crypto).

// Look-alike characters (0/O, 1/l/I) are left out so a password can be read out or copied by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomIndex(n: number): number {
  // Rejection sampling: every character equally likely.
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  do globalThis.crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

// 16 random characters in 4 groups, e.g. "Kx7m-Pq3r-Tz9a-Hw4e" (~93 bits of randomness).
export function generatePassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) group += ALPHABET[randomIndex(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join("-");
}
