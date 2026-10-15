import type { ReactNode } from "react";

/** One workspace page: a sidebar with the person and their sections, a header, and the section's content. */
export interface NavItem { id: string; label: string; icon: string; pill?: string }

interface Props {
  person: { initial: string; name: string; role: string };
  items: NavItem[]; active: string; onSelect: (id: string) => void;
  onBack: () => void; foot: ReactNode;
  breadcrumb: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode;
  children: ReactNode;
}

export function Shell({ person, items, active, onSelect, onBack, foot, breadcrumb, title, sub, actions, children }: Props) {
  return (
    <section className="succ">
      <div className="succ-layout">
        <aside className="succ-nav">
          <div className="succ-nav-brand">Hand<i>over</i></div>
          <button className="succ-nav-home" onClick={onBack}>← Back to home</button>
          <div className="succ-nav-person"><span className="succ-avatar">{person.initial}</span><span><b>{person.name}</b><small>{person.role}</small></span></div>
          <div className="succ-nav-label">Workspace</div>
          <nav role="tablist" aria-label="Workspace">
            {items.map((item) => (
              <button key={item.id} role="tab" aria-selected={active === item.id} className={active === item.id ? "on" : ""} onClick={() => onSelect(item.id)}>
                <span className="succ-nav-icon">{item.icon}</span><span>{item.label}</span>{item.pill && <span className="pill-new">{item.pill}</span>}
              </button>
            ))}
          </nav>
          <div className="succ-nav-foot">{foot}</div>
        </aside>
        <section className="succ-content">
          <header className="succ-head">
            <div>
              <div className="succ-breadcrumb">{breadcrumb}</div>
              <div className="succ-title"><h1>{title}</h1>{sub && <span className="succ-stats">{sub}</span>}</div>
            </div>
            {actions && <div className="succ-head-actions">{actions}</div>}
          </header>
          <div className="succ-body">{children}</div>
        </section>
      </div>
    </section>
  );
}
