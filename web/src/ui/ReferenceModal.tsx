import React, { type ReactNode } from "react";

export function ReferenceModal({
  children,
  description,
  title
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="reference-modal" aria-label={title}>
      <header className="reference-modal-head">
        <div>
          <strong>{title}</strong>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      <div className="reference-modal-body">{children}</div>
    </section>
  );
}
