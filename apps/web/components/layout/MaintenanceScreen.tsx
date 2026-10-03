import type { SystemSettings } from '@viecpro/shared';
import './maintenance.css';

type SiteSystem = Pick<SystemSettings, 'supportPhone' | 'supportEmail' | 'maintenanceMessage'>;

export default function MaintenanceScreen({ system }: { system: SiteSystem }) {
  const phone = system.supportPhone.replace(/[^\d+]/g, '');
  return (
    <main className="maintenance-screen" role="status" aria-live="polite">
      <section className="maintenance-screen__card">
        <a className="maintenance-screen__brand" href="/" aria-label="ViecPro">
          <span className="maintenance-screen__mark" aria-hidden="true">✓</span>
          <span>Viec<span>Pro</span></span>
        </a>
        <div className="maintenance-screen__illustration" aria-hidden="true">
          <span className="maintenance-screen__sun" />
          <span className="maintenance-screen__gear">⚙</span>
          <span className="maintenance-screen__spark maintenance-screen__spark--one">✦</span>
          <span className="maintenance-screen__spark maintenance-screen__spark--two">✦</span>
        </div>
        <p className="maintenance-screen__eyebrow">VIECPro ĐANG NÂNG CẤP</p>
        <h1>Chúng tôi sẽ trở lại sớm</h1>
        <p className="maintenance-screen__message">{system.maintenanceMessage}</p>
        <button className="maintenance-screen__retry" type="button" onClick={() => window.location.reload()}>
          Thử lại
          <span aria-hidden="true">↻</span>
        </button>
        <div className="maintenance-screen__support">
          <span>Cần hỗ trợ trong lúc này?</span>
          <div>
            <a href={`tel:${phone}`}>{system.supportPhone}</a>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${system.supportEmail}`}>{system.supportEmail}</a>
          </div>
        </div>
      </section>
    </main>
  );
}
