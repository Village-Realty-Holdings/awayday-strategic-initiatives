"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button for `<form action={serverAction}>` forms. Reads the parent
 * form's pending state (React 19 `useFormStatus`), disables itself and shows a
 * spinner while the action runs, so double-submits are impossible.
 *
 * Must be rendered inside the `<form>`. Forms that submit via `onSubmit` /
 * `useTransition` don't drive `useFormStatus`: use `<Button type="submit"
 * disabled={...}>` there instead.
 */
function SubmitButton({
  children,
  disabled,
  ...props
}: Omit<ButtonProps, "type" | "asChild">) {
  const { pending } = useFormStatus();
  // Icon-only buttons (icon/bare sizes, or a lone component child such as a
  // lucide icon) swap the icon for the spinner so the button doesn't change size.
  const kids = React.Children.toArray(children);
  const iconOnly =
    props.size === "icon" ||
    props.size === "bare" ||
    (kids.length === 1 && React.isValidElement(kids[0]) && typeof kids[0].type !== "string");
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {pending && iconOnly ? null : children}
    </Button>
  );
}

export { SubmitButton };
