export const EMPTY_AFFECTIVE = {
  a0: "", a1: "", a2: "", a3: "", a4: "",
  a5: "", a6: "", a7: "", a8: "", a9: "",
};

export const EMPTY_PSYCHOMOTOR = {
  p0: "", p1: "", p2: "", p3: "", p4: "", p5: "",
};

export const AFFECTIVE_LABELS = [
  "Punctuality",
  "Perseverance",
  "Neatness",
  "Honesty",
  "Attentiveness",
  "Politeness",
  "Leadership",
  "Relationship with Students",
  "Emotional Stability",
  "Health",
];

export const PSYCHOMOTOR_LABELS = [
  "Handling of Tools",
  "Sports and Games",
  "Musical Skills",
  "Drawing & Painting",
  "Verbal Fluency",
  "Writing",
];

export const RATING_OPTIONS = ["5", "4", "3", "2", "1"];

export const EMPTY_SUBJECT_ROWS = (): {
  id: number;
  sub: string;
  ca: string;
  exam: string;
  sa: string;
}[] =>
  Array.from({ length: 8 }, (_, i) => ({
    id: i,
    sub: "",
    ca: "",
    exam: "",
    sa: "",
  }));