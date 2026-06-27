import { User } from "../db/models/User.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signSession } from "../auth/jwt.js";
import { HttpError } from "../utils/httpError.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

function toPublicUser(user: { _id: unknown; name: string; email: string }): PublicUser {
  return { id: String(user._id), name: user.name, email: user.email };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const email = input.email.toLowerCase();

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, "An account with that email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({ name: input.name, email, passwordHash });

  const token = signSession({ userId: String(user._id) });
  return { user: toPublicUser(user), token };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const email = input.email.toLowerCase();

  const user = await User.findOne({ email });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = signSession({ userId: String(user._id) });
  return { user: toPublicUser(user), token };
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError(401, "Not authenticated");
  }
  return toPublicUser(user);
}
