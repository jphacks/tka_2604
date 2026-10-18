import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// OWASP's 16 MiB scrypt configuration also fits Workers' native scrypt cost cap.
// Keep the supported parameters explicit: a stored hash must not choose the
// amount of memory or CPU consumed by a login request.
const parameters = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }
const prefix = 'scrypt$1$16384$8$5$'
const format = /^scrypt\$1\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{64})$/
const serializedLength = prefix.length + 32 + 1 + 64
const dummySalt = new Uint8Array(16)
const dummyKey = new Uint8Array(32)
const encoder = new TextEncoder()

function validPassword(password: string) {
  // The character check also bounds allocation before encoding oversized input.
  return (
    password.length > 0 &&
    password.length <= 1024 &&
    encoder.encode(password).byteLength <= 1024
  )
}

function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, parameters, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function fromHex(hex: string) {
  return Uint8Array.from({ length: hex.length / 2 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  )
}

export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password))
    throw new RangeError(
      'Password must contain between 1 and 1024 UTF-8 bytes.',
    )
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)
  return `${prefix}${toHex(salt)}$${toHex(key)}`
}

export async function verifyPassword(
  password: string,
  serializedHash: string | null | undefined,
): Promise<boolean> {
  if (!validPassword(password)) return false
  const parsed =
    typeof serializedHash === 'string' &&
    serializedHash.length === serializedLength
      ? format.exec(serializedHash)
      : null
  // Unknown users and corrupt/legacy hashes perform the same expensive work
  // as a valid credential. A dummy comparison can never authenticate a user.
  const salt = parsed ? fromHex(parsed[1]) : dummySalt
  const expected = parsed ? fromHex(parsed[2]) : dummyKey
  const actual = await deriveKey(password, salt)
  const matches = timingSafeEqual(actual, expected)
  return parsed !== null && matches
}
