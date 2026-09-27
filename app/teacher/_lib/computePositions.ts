export function computePositions(students: any[]): Record<string, any> {
  const subjectTotals: Record<string, number[]> = {};

  students.forEach((s) => {
    (s.assessment?.subjects || []).forEach((sub: any) => {
      const ca = sub.ca !== "" ? parseFloat(sub.ca) : null;
      const ex = sub.exam !== "" ? parseFloat(sub.exam) : null;
      if (ca === null && ex === null) return;
      const tt = (ca || 0) + (ex || 0);
      if (!subjectTotals[sub.sub]) subjectTotals[sub.sub] = [];
      subjectTotals[sub.sub].push(tt);
    });
  });

  const statsBySubject: Record<
    string,
    { highest: number; lowest: number; average: number; sortedDesc: number[] }
  > = {};
  Object.entries(subjectTotals).forEach(([name, totals]) => {
    const sorted = [...totals].sort((a, b) => b - a);
    statsBySubject[name] = {
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
      average: totals.reduce((a, b) => a + b, 0) / totals.length,
      sortedDesc: sorted,
    };
  });

  const studentInfo: Record<string, any> = {};
  const studentTotals: { id: string; total: number }[] = [];

  students.forEach((s) => {
    const subs = s.assessment?.subjects || [];
    let total = 0;
    let count = 0;
    const subjectStats: Record<string, any> = {};

    subs.forEach((sub: any) => {
      const ca = sub.ca !== "" ? parseFloat(sub.ca) : null;
      const ex = sub.exam !== "" ? parseFloat(sub.exam) : null;
      if (ca === null && ex === null) return;
      const tt = (ca || 0) + (ex || 0);
      total += tt;
      count++;

      const stats = statsBySubject[sub.sub];
      const rank = stats.sortedDesc.indexOf(tt) + 1;
      subjectStats[sub.sub] = {
        position: rank,
        highest: stats.highest,
        lowest: stats.lowest,
        average: stats.average,
      };
    });

    const avg = count > 0 ? total / count : 0;
    studentTotals.push({ id: s.id, total });
    studentInfo[s.id] = {
      total,
      average: avg,
      classSize: students.length,
      position: 0,
      subjects: subjectStats,
    };
  });

  const sortedByTotal = [...studentTotals].sort((a, b) => b.total - a.total);
  studentTotals.forEach((st) => {
    const rank = sortedByTotal.findIndex((x) => x.total === st.total) + 1;
    studentInfo[st.id].position = rank;
  });

  return studentInfo;
}