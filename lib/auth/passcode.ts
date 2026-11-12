import bcrypt from "bcryptjs";

export async function hashPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(passcode.trim(), 10);
}

export async function checkPasscode(input: string, hash: string): Promise<boolean> {
  return bcrypt.compare(input.trim(), hash);
}
