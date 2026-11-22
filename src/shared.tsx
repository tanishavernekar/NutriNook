import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  close,
  children,
  className,
  headerAction,
  scrollLabel,
}: {
  title: string;
  className?: string;
  headerAction?: ReactNode;
  scrollLabel?: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
      className={className}
    >
      <header>
        <h2 tabIndex={headerAction ? -1 : undefined}>{title}</h2>
        {headerAction}
        <button aria-label="Close dialog" onClick={close}>
          <X />
        </button>
      </header>
      <div className="modal-body" role={scrollLabel ? "region" : undefined}
        aria-label={scrollLabel} tabIndex={scrollLabel ? 0 : undefined}>{children}</div>
    </dialog>
  );
}
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
