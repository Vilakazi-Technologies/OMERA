"use client";

import { useUser } from "@clerk/nextjs";

/** Human-friendly label from Clerk — never raw user ids in the UI. */
export function UserProfileLabel() {
  const { isLoaded, user } = useUser();
  if (!isLoaded || !user) {
    return <span className="text-white/45">Signed in</span>;
  }
  const name =
    user.fullName?.trim() ||
    user.firstName?.trim() ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Omera member";
  const email = user.primaryEmailAddress?.emailAddress;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-white/90">{name}</p>
      {email ? (
        <p className="truncate text-[11px] text-white/40">{email}</p>
      ) : null}
    </div>
  );
}
