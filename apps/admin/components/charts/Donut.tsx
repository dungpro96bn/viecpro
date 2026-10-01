import './charts.css';

const R = 15.9;

/** Biểu đồ tròn tối đa 4 phần (màu theo class donut__slice--c1…c4) */
export default function Donut({ parts, value, unit }: { parts: number[]; value: string; unit: string }) {
  const total = parts.reduce((s, x) => s + x, 0) || 1;
  let offset = 0;
  return (
    <span className="donut">
      <svg className="donut__svg" width="132" height="132" viewBox="0 0 42 42" aria-hidden="true">
        <circle className="donut__track" cx="21" cy="21" r={R} />
        {parts.map((p, i) => {
          const pct = (p / total) * 100;
          const slice = <circle key={i} className={`donut__slice donut__slice--c${i + 1}`} cx="21" cy="21" r={R} strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset} />;
          offset += pct;
          return slice;
        })}
      </svg>
      <span className="donut__center">
        <b className="donut__value">{value}</b>
        <span className="donut__unit">{unit}</span>
      </span>
    </span>
  );
}
