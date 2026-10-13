"use client";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { useState } from "react";
import type { DoctorProfile } from "@/lib/account";

export function ProfileAvatar({
  profile,
  size = 40,
}: {
  profile: DoctorProfile | null;
  size?: number;
}) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const initials = profile?.fullName
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 font-semibold text-teal-800 ring-1 ring-slate-200"
      style={{ width: size, height: size }}
    >
      {initials || <UserRound aria-hidden="true" size={21} />}
      {profile?.avatarPath && failedPath !== profile.avatarPath && (
        <Image
          src={`/api/account/avatar?v=${encodeURIComponent(profile.avatarPath)}`}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedPath(profile.avatarPath)}
        />
      )}
    </span>
  );
}
