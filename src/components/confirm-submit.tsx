"use client";

// Submit button that asks for confirmation before letting its parent form
// post (Adam 7/10: "are you sure?" before deleting review templates).
export function ConfirmSubmit({
  message,
  className,
  children,
  ariaLabel,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
