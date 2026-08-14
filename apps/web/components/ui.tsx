import Link from "next/link";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: React.ReactNode; description?: string; actions?: React.ReactNode }) {
  return <header className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description ? <p className="lead">{description}</p> : null}</div>{actions ? <div className="page-actions">{actions}</div> : null}</header>;
}

export function EmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">○</span><h2>{title}</h2><p>{description}</p>{actionHref && actionLabel ? <Link className="button secondary" href={actionHref}>{actionLabel}</Link> : null}</div>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description ? <p className="muted">{description}</p> : null}</div>{action}</div>;
}
