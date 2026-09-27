import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Types ──
export interface SubjectInput {
  sub: string;
  ca: string;
  exam: string;
  sa: string;
}

export interface SubjectStatsInput {
  position: number;
  highest: number;
  lowest: number;
  average: number;
}

export interface PositionsInput {
  position: number;
  classSize: number;
  average: number;
  subjects: Record<string, SubjectStatsInput>;
}

export interface GradeBandInput {
  min_score: number;
  max_score: number;
  grade: string;
  remark: string;
}

export interface ReportCardInput {
  schoolName: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;

  studentName: string;
  studentId: string;
  sex: string;
  age: string;
  className: string;
  session: string;
  term: string;
  classAvg: string;

  daysOpened: string;
  daysPresent: string;
  daysAbsent: string;

  subjects: SubjectInput[];
  affective: Record<string, string>;
  psychomotor: Record<string, string>;

  teacherName: string;
  headTeacherName: string;
  teacherRemark: string;
  headRemark: string;
  nextTerm: string;
  promotion: string;

  positions?: PositionsInput;
  termAverages?: Record<string, number>;
  cumulativeAverage?: number | null;

  gradeBands: GradeBandInput[];
}

// ── Helpers ──
function lookupGrade(score: number | null, bands: GradeBandInput[]) {
  if (score === null || isNaN(score)) return { g: "—", remark: "—" };
  const band = bands.find((b) => score >= b.min_score && score <= b.max_score);
  return band ? { g: band.grade, remark: band.remark } : { g: "—", remark: "—" };
}

interface ProcessedSubject {
  subject: string;
  ca: number | string;
  exam: number | string;
  tt: number | string;
  sessAvg: number | string;
  g: string;
  remark: string;
}

function collectSubjects(
  subjects: SubjectInput[],
  bands: GradeBandInput[],
): ProcessedSubject[] {
  return subjects
    .map((s) => {
      const ca = s.ca !== "" ? parseFloat(s.ca) : null;
      const ex = s.exam !== "" ? parseFloat(s.exam) : null;
      const sa = s.sa !== "" ? parseFloat(s.sa) : null;
      if (!s.sub && ca === null && ex === null) return null;
      const tt = ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
      const { g, remark } =
        tt !== null ? lookupGrade(tt, bands) : { g: "—", remark: "—" };
      return {
        subject: s.sub || "(Unnamed)",
        ca: ca !== null ? ca : "—",
        exam: ex !== null ? ex : "—",
        tt: tt !== null ? tt : "—",
        sessAvg: sa !== null ? sa : "—",
        g,
        remark,
      };
    })
    .filter((item): item is ProcessedSubject => item !== null);
}

// ── Main draw function ──
export function drawReportCardPage(doc: jsPDF, data: ReportCardInput): void {
  const subjectsData = collectSubjects(data.subjects, data.gradeBands);

  const tts = subjectsData
    .map((s) => s.tt)
    .filter((tt): tt is number => typeof tt === "number");
  const sas = subjectsData
    .map((s) => s.sessAvg)
    .filter((sa): sa is number => typeof sa === "number");

  const termAvg = tts.length ? tts.reduce((a, b) => a + b, 0) / tts.length : 0;
  const finalAvg = sas.length
    ? sas.reduce((a, b) => a + b, 0) / sas.length
    : termAvg;
  const { g: finalGrade } = lookupGrade(finalAvg, data.gradeBands);

  const W = 210,
    PL = 12,
    PR = 12,
    CW = W - PL - PR;
  const subjectStats = data.positions?.subjects || {};
  const studentPosition = data.positions?.position;
  const classSize = data.positions?.classSize;
  const termAverages = data.termAverages || {};
  const cumulativeAverage = data.cumulativeAverage ?? null;

  doc.setFillColor(26, 79, 160);
  doc.rect(0, 0, W, 2, "F");

  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(15, 17, 23);
  doc.text(data.schoolName || "School Name", W / 2, 15, { align: "center" });

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(80, 70, 60);
  const contactParts = [
    data.schoolAddress,
    data.schoolEmail ? ":" + data.schoolEmail : null,
    data.schoolPhone,
  ].filter(Boolean);
  doc.text(contactParts.join("   "), W / 2, 22, { align: "center" });

  doc.setFillColor(26, 79, 160).rect(PL, 27, CW, 8.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  const banner = [data.session, (data.term || "TERM REPORT").toUpperCase()]
    .filter(Boolean)
    .join(" – ");
  doc.text(banner, W / 2, 33, { align: "center" });

  let y = 40;
  doc.setFillColor(248, 246, 240);
  doc.rect(PL, y, CW, 30, "F");
  doc.setDrawColor(212, 207, 195).setLineWidth(0.3).rect(PL, y, CW, 30, "S");

  const L: [string, string | number][] = [
    ["NAME OF PUPIL:", data.studentName],
    ["SEX:", data.sex || "—"],
    ["AGE:", data.age || "—"],
    ["STUDENT ID:", data.studentId || "—"],
    ["CLASS:", data.className || "—"],
  ];
  const R: [string, string | number][] = [
    ["TERM AVG SCORE:", termAvg.toFixed(1) + " %"],
    ["FINAL GRADE:", finalGrade],
    ["FINAL AVG SCORE:", finalAvg.toFixed(1) + " %"],
    [
      "POSITION IN CLASS:",
      studentPosition ? `${studentPosition} of ${classSize}` : "—",
    ],
    ["CLASS AVG SCORE:", data.classAvg ? data.classAvg + "%" : "—"],
  ];

  L.forEach((r, i) => {
    doc.setFont("helvetica", "bold").setFontSize(7.8).setTextColor(80, 70, 60);
    doc.text(r[0], PL + 3, y + 6.5 + i * 5.2);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(15, 17, 23);
    doc.text(String(r[1]), PL + 36, y + 6.5 + i * 5.2);
  });

  R.forEach((r, i) => {
    doc.setFont("helvetica", "bold").setFontSize(7.8).setTextColor(80, 70, 60);
    doc.text(r[0], PL + CW / 2 + 2, y + 6.5 + i * 5.2);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(15, 17, 23);
    doc.text(String(r[1]), PL + CW / 2 + 38, y + 6.5 + i * 5.2);
  });

  y += 34;
  doc.setFillColor(26, 79, 160).rect(PL, y, CW, 7, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255);
  doc.text("COGNITIVE DOMAIN", W / 2, y + 4.8, { align: "center" });
  y += 7;

  autoTable(doc, {
    startY: y,
    head: [
      ["SUBJECT", "CA", "EXAM", "TOTAL", "POS", "CLASS\nAVG", "GRADE", "REMARK"],
    ],
    body: subjectsData.map((s) => [
      s.subject,
      s.ca,
      s.exam,
      s.tt,
      subjectStats[s.subject]?.position ?? "—",
      subjectStats[s.subject]?.average != null
        ? Number(subjectStats[s.subject].average).toFixed(1)
        : "—",
      s.g,
      s.remark,
    ]),
    margin: { left: PL, right: PR },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [15, 17, 23],
    },
    headStyles: {
      fillColor: [240, 237, 229],
      textColor: [15, 17, 23],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 34, halign: "left" },
      1: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 12, halign: "center" },
      7: { halign: "left" },
    },
    alternateRowStyles: { fillColor: [249, 247, 242] },
    didParseCell: function (d: any) {
      if (d.section === "body" && d.column.index === 6) {
        const g = d.cell.raw;
        if (g === "A") {
          d.cell.styles.textColor = [42, 122, 75];
          d.cell.styles.fontStyle = "bold";
        } else if (g === "B") {
          d.cell.styles.textColor = [26, 79, 160];
          d.cell.styles.fontStyle = "bold";
        } else if (g === "C") {
          d.cell.styles.textColor = [154, 98, 0];
        } else if (g === "D") {
          d.cell.styles.textColor = [192, 57, 43];
        } else if (g === "F") {
          d.cell.styles.textColor = [139, 26, 26];
          d.cell.styles.fontStyle = "bold";
        }
      }
      if (d.section === "body" && d.column.index === 7) {
        const r = d.cell.raw;
        if (r === "Excellent") d.cell.styles.textColor = [42, 122, 75];
        else if (r === "Very Good" || r === "Credit")
          d.cell.styles.textColor = [26, 79, 160];
        else if (r === "Fail") d.cell.styles.textColor = [192, 57, 43];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY;

  if (Object.keys(termAverages).length > 1 || cumulativeAverage != null) {
    const cumQ = CW / 4;
    doc.setFillColor(26, 79, 160).rect(PL, y, cumQ, 7, "F");
    doc.setFillColor(26, 79, 160).rect(PL + cumQ, y, cumQ, 7, "F");
    doc.setFillColor(26, 79, 160).rect(PL + 2 * cumQ, y, cumQ, 7, "F");
    doc.setFillColor(42, 122, 75).rect(PL + 3 * cumQ, y, cumQ, 7, "F");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(255, 255, 255);
    doc.text(
      "1ST TERM: " +
        (termAverages.First != null
          ? termAverages.First.toFixed(1) + "%"
          : "—"),
      PL + cumQ / 2,
      y + 4.8,
      { align: "center" },
    );
    doc.text(
      "2ND TERM: " +
        (termAverages.Second != null
          ? termAverages.Second.toFixed(1) + "%"
          : "—"),
      PL + cumQ + cumQ / 2,
      y + 4.8,
      { align: "center" },
    );
    doc.text(
      "3RD TERM: " +
        (termAverages.Third != null
          ? termAverages.Third.toFixed(1) + "%"
          : "—"),
      PL + 2 * cumQ + cumQ / 2,
      y + 4.8,
      { align: "center" },
    );
    doc.text(
      "CUMULATIVE: " +
        (cumulativeAverage != null ? cumulativeAverage.toFixed(1) + "%" : "—"),
      PL + 3 * cumQ + cumQ / 2,
      y + 4.8,
      { align: "center" },
    );
    y += 8;
  }

  const third = CW / 3;
  doc.setFillColor(26, 79, 160).rect(PL, y, third, 7, "F");
  doc.setFillColor(42, 122, 75).rect(PL + third, y, third, 7, "F");
  doc.setFillColor(192, 57, 43).rect(PL + 2 * third, y, third, 7, "F");
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text(
    "NO OF DAYS SCHOOL OPENED: " + (data.daysOpened || "—"),
    PL + third / 2,
    y + 4.8,
    { align: "center" },
  );
  doc.text(
    "NO OF DAYS PRESENT: " + (data.daysPresent || "—"),
    PL + third + third / 2,
    y + 4.8,
    { align: "center" },
  );
  doc.text(
    "NO OF DAYS ABSENT: " + (data.daysAbsent || "—"),
    PL + 2 * third + third / 2,
    y + 4.8,
    { align: "center" },
  );
  y += 10;

  if (y > 185) {
    doc.addPage();
    y = 14;
  }

  const affRows: [string, string | undefined][] = [
    ["Punctuality", data.affective.a0],
    ["Perseverance", data.affective.a1],
    ["Neatness", data.affective.a2],
    ["Honesty", data.affective.a3],
    ["Attentiveness", data.affective.a4],
    ["Politeness", data.affective.a5],
    ["Leadership", data.affective.a6],
    ["Relationship with students", data.affective.a7],
    ["Emotional stability", data.affective.a8],
    ["Health", data.affective.a9],
  ];

  const psyRows: [string, string | undefined][] = [
    ["Handing of tools", data.psychomotor.p0],
    ["Sports and games", data.psychomotor.p1],
    ["Musical skills", data.psychomotor.p2],
    ["Drawing painting", data.psychomotor.p3],
    ["Verbal fluency", data.psychomotor.p4],
    ["Writing", data.psychomotor.p5],
  ];

  const aW = CW * 0.34,
    pW = CW * 0.27,
    kW = CW - aW - pW - 4;
  const rH = 6.0;

  doc.setFillColor(26, 79, 160).rect(PL, y, aW, 7, "F");
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text("AFFECTIVE DOMAIN", PL + aW / 2, y + 4.8, { align: "center" });
  doc.setFillColor(26, 79, 160).rect(PL + aW + 2, y, pW, 7, "F");
  doc.text("PSYCHOMOTOR SKILLS", PL + aW + 2 + pW / 2, y + 4.8, {
    align: "center",
  });
  doc.setFillColor(26, 79, 160).rect(PL + aW + pW + 4, y, kW, 7, "F");
  doc.text("KEY TO SUBJECT GRADING", PL + aW + pW + 4 + kW / 2, y + 4.8, {
    align: "center",
  });
  y += 7;

  affRows.forEach((row, i) => {
    const ry = y + i * rH;
    if (i % 2 === 0) {
      doc.setFillColor(249, 247, 242);
      doc.rect(PL, ry, aW, rH, "F");
    }
    doc.setDrawColor(220, 215, 205).setLineWidth(0.2).rect(PL, ry, aW, rH, "S");
    doc.setFont("helvetica", "normal").setFontSize(7.8).setTextColor(15, 17, 23);
    doc.text(row[0], PL + 2, ry + 4.1);
    if (row[1]) {
      doc.setFont("helvetica", "bold");
      doc.text(row[1], PL + aW - 3, ry + 4.1, { align: "right" });
    }
  });

  psyRows.forEach((row, i) => {
    const ry = y + i * rH;
    if (i % 2 === 0) {
      doc.setFillColor(249, 247, 242);
      doc.rect(PL + aW + 2, ry, pW, rH, "F");
    }
    doc
      .setDrawColor(220, 215, 205)
      .setLineWidth(0.2)
      .rect(PL + aW + 2, ry, pW, rH, "S");
    doc.setFont("helvetica", "normal").setFontSize(7.8).setTextColor(15, 17, 23);
    doc.text(row[0], PL + aW + 4, ry + 4.1);
    if (row[1]) {
      doc.setFont("helvetica", "bold");
      doc.text(row[1], PL + aW + 2 + pW - 3, ry + 4.1, { align: "right" });
    }
  });

  const kX = PL + aW + pW + 4;
  const kRows: [string, string, string][] = [
    ["70-100", "Excellent", "A"],
    ["60-69", "Good", "B"],
    ["50-59", "Credit", "C"],
    ["40-49", "Pass", "D"],
    ["30-39", "Fail", "F"],
  ];

  kRows.forEach((row, i) => {
    const ry = y + i * rH;
    if (i % 2 === 0) {
      doc.setFillColor(249, 247, 242);
      doc.rect(kX, ry, kW, rH, "F");
    }
    doc.setDrawColor(220, 215, 205).setLineWidth(0.2).rect(kX, ry, kW, rH, "S");
    doc.setFont("helvetica", "normal").setFontSize(7.8).setTextColor(15, 17, 23);
    doc.text(row[0], kX + 2, ry + 4.1);
    doc.text(row[1], kX + 14, ry + 4.1);
    const gc =
      row[2] === "A"
        ? [42, 122, 75]
        : row[2] === "B"
          ? [26, 79, 160]
          : row[2] === "C"
            ? [154, 98, 0]
            : row[2] === "D"
              ? [180, 80, 30]
              : [192, 57, 43];
    doc.setFont("helvetica", "bold").setTextColor(gc[0], gc[1], gc[2]);
    doc.text(row[2], kX + kW - 3, ry + 4.1, { align: "right" });
  });

  const psyBottom = y + psyRows.length * rH;
  const kAffW = pW + kW + 2;
  doc.setFillColor(240, 237, 229).setDrawColor(220, 215, 205).setLineWidth(0.2);
  doc.rect(PL + aW + 2, psyBottom, kAffW, 6, "FD");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(15, 17, 23);
  doc.text(
    "KEY TO AFFECTIVE DOMAIN & PSYCHOMOTOR",
    PL + aW + 2 + kAffW / 2,
    psyBottom + 4,
    { align: "center" },
  );

  const keyScale = [
    "5- Excellent",
    "4- Very good",
    "3- Good",
    "2- Average",
    "1- Below average",
  ];
  let ky = psyBottom + 6;
  const half = Math.ceil(keyScale.length / 2);
  keyScale.forEach((txt, i) => {
    const col = i < half ? PL + aW + 4 : PL + aW + 2 + kAffW / 2 + 2;
    const row = i < half ? i : i - half;
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(15, 17, 23);
    doc.text(txt, col, ky + row * 5.2);
  });

  y = Math.max(y + affRows.length * rH, ky + half * 5.2) + 8;
  if (y > 252) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 17, 23);
  doc.text("CLASS TEACHER'S REMARK:", PL, y);
  y += 7;
  if (data.teacherRemark) {
    const lines = doc.splitTextToSize(data.teacherRemark, CW);
    doc.setFont("helvetica", "normal").setFontSize(9).text(lines, PL, y);
    y += lines.length * 5.3 + 7;
  } else {
    doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(160, 150, 140);
    doc.text("No remark entered.", PL + 2, y);
    y += 9;
  }

  if (y > 258) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 17, 23);
  doc.text("HEAD TEACHER'S COMMENT:", PL, y);
  y += 7;
  if (data.headRemark) {
    const lines = doc.splitTextToSize(data.headRemark, CW);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(15, 17, 23);
    doc.text(lines, PL, y);
    y += lines.length * 5.3 + 7;
  } else {
    doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(160, 150, 140);
    doc.text("No comment entered.", PL + 2, y);
    y += 9;
  }

  if (data.promotion) {
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(26, 79, 160);
    doc.text("PROMOTION STATUS: " + data.promotion, PL, y);
    y += 8;
  }

  if (data.nextTerm) {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
    doc.setFillColor(26, 79, 160).rect(PL, y, CW, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255);
    doc.text("NEXT TERM BEGINS: " + data.nextTerm, W / 2, y + 5.5, {
      align: "center",
    });
    y += 11;
  }

  if (y < 260) y = 260;
  doc.setDrawColor(180, 175, 165).setLineWidth(0.5);
  doc.line(PL, y, PL + 55, y);
  doc.line(W - PR - 55, y, W - PR, y);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(130, 120, 110);
  doc.text(
    data.teacherName
      ? data.teacherName + " (Class Teacher)"
      : "Class Teacher's Signature",
    PL,
    y + 5,
  );
  doc.text(
    data.headTeacherName
      ? data.headTeacherName + " (Head Teacher)"
      : "Head Teacher's Signature",
    W - PR - 55,
    y + 5,
  );

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(190, 185, 175);
  doc.text(
    "Generated by SchoolResult · " +
      new Date().toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    W / 2,
    292,
    { align: "center" },
  );
}

// ── Public API ──
export function generateSingleReportCard(data: ReportCardInput): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawReportCardPage(doc, data);
  return doc;
}

export function generateBatchReportCards(items: ReportCardInput[]): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  items.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    drawReportCardPage(doc, item);
  });
  return doc;
}