"use client";

import { useEffect } from "react";
import { ar } from "@/content/ar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-20">
      <ErrorState title={ar.states.errorTitle} text={ar.states.errorText}>
        <Button variant="primary" onClick={reset}>
          {ar.states.retry}
        </Button>
        <ButtonLink href="/" variant="secondary">
          {ar.states.home}
        </ButtonLink>
      </ErrorState>
    </div>
  );
}
