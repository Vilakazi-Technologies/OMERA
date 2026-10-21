"use client";

import { Suspense } from "react";
import { AuthFlowNotice } from "@/components/auth/auth-flow-notice";

export function AuthFlowNoticeBoundary({
  mode,
}: {
  mode: "sign-in" | "sign-up";
}) {
  return (
    <Suspense fallback={null}>
      <AuthFlowNotice mode={mode} />
    </Suspense>
  );
}
