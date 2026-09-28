"use client";

export function CumulativeCard({
  termAverages,
  cumulativeAverage,
}: {
  termAverages: Record<string, number>;
  cumulativeAverage: number | null;
}) {
  const hasData =
    Object.keys(termAverages).length > 1 || cumulativeAverage != null;
  if (!hasData) return null;

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="card-title">
        <span className="ic">📈</span>Session Cumulative Average
      </div>
      <div className="summary-strip" style={{ marginBottom: 0 }}>
        {["First", "Second", "Third"].map((t) => (
          <div className="stat" key={t}>
            <span className="sl">{t} Term</span>
            <span className="sv">
              {termAverages[t] != null
                ? termAverages[t].toFixed(1) + "%"
                : "—"}
            </span>
          </div>
        ))}
        <div className="stat">
          <span className="sl">Cumulative</span>
          <span className="sv">
            {cumulativeAverage != null
              ? cumulativeAverage.toFixed(1) + "%"
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}