import bcrypt from "bcryptjs";
import { z } from "zod";

// Public requests are never allowed to select their own role or active status.
export const accessRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200)
}).strict();

export type PendingAccessAccount = {
  name: string;
  email: string;
  passwordHash: string;
  role: "CONSULTA";
  active: false;
};

export type AccessRequestRepository = {
  emailExists(email: string): Promise<boolean>;
  createPendingUser(account: PendingAccessAccount): Promise<void>;
};

export type AccessRequestResult = "accepted" | "invalid";

// The response does not reveal whether an address already has an account.
// Existing active/blocked accounts must never have credentials overwritten by signup.
export async function submitAccessRequest(
  input: unknown,
  repository: AccessRequestRepository,
  hashPassword: (password: string) => Promise<string> = password => bcrypt.hash(password, 12)
): Promise<AccessRequestResult> {
  const result = accessRequestSchema.safeParse(input);
  if (!result.success) return "invalid";

  const email = result.data.email.toLowerCase();
  if (await repository.emailExists(email)) return "accepted";

  const passwordHash = await hashPassword(result.data.password);
  try {
    await repository.createPendingUser({
      name: result.data.name,
      email,
      passwordHash,
      role: "CONSULTA",
      active: false
    });
  } catch (error) {
    // Concurrent registrations for the same email: respond identically.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return "accepted";
    }
    throw error;
  }
  return "accepted";
}
