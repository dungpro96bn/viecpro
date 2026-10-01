import { CONTACT_ICON_PATH, type ContactIcon } from '@/lib/profiles';
import { PathIcon } from '../ui/Icons';
import './profile.css';
import RecruiterPhone from './RecruiterPhone';

export default function ContactList({ items, recruiterSlug }: { items: Array<{ label: string; value: string; icon: ContactIcon }>; recruiterSlug?: string }) {
  return (
    <div className="contact-list">
      {items.map((c) => (
        <div key={c.label} className="contact-item">
          <span className="contact-item__icon">
            <PathIcon d={CONTACT_ICON_PATH[c.icon]} size={17} />
          </span>
          <span className="contact-item__text">
            <span className="contact-item__label">{c.label}</span>
            {c.icon === 'phone' && recruiterSlug ? <RecruiterPhone slug={recruiterSlug} initial={c.value} /> : c.icon === 'phone' ? <a className="contact-item__value" href={`tel:${c.value.replace(/[^+\d]/g, '')}`}>{c.value}</a> : c.icon === 'mail' ? <a className="contact-item__value" href={`mailto:${c.value}`}>{c.value}</a> : c.icon === 'web' ? <a className="contact-item__value" href={`https://${c.value.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer">{c.value}</a> : <span className="contact-item__value">{c.value}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
