// -----------------------------------------------------------------------------
//  Adhoc request parsing (Task 3)
//  The Instructor-flow workflow posts a fixed Q&A form into
//  #instructor-adhoc-request-1. We parse each message into structured fields by
//  using the known question labels as delimiters — robust to bullet/formatting
//  differences, tolerant of missing questions, and tolerant of the two known
//  wordings of the "problem" and "outcome" questions.
// -----------------------------------------------------------------------------

export type AdhocFields = {
  raised_by: string | null;
  program: string | null;
  batch: string | null;
  module: string | null;
  beneficiary: string | null;
  problem: string | null;
  learners_impact: string | null;
  risk_if_not_done: string | null;
  outcome: string | null;
  module_owner: string | null;
  stakeholder: string | null;
};

// Order matters: labels are matched in the order they appear in the message.
// Each field lists all known wordings (aliases) — the parser matches any of them.
const QUESTIONS: { key: keyof AdhocFields; labels: string[] }[] = [
  { key: "raised_by", labels: ["Raised by"] },
  {
    key: "program",
    labels: ["For which program we are raising this for?", "For which program are we raising this"],
  },
  {
    key: "batch",
    labels: [
      "Could you please confirm which batch is this required for?",
      "which batch is this required for",
    ],
  },
  {
    key: "module",
    labels: [
      "Can you highlight for which module we are solving for in the respective program?",
      "for which module we are solving",
    ],
  },
  {
    key: "problem",
    labels: [
      "What is the problem statement we are solving for?",
      "What problem are we trying to solve?",
    ],
  },
  { key: "beneficiary", labels: ["Who will benefit from this?"] },
  { key: "learners_impact", labels: ["How many learners will this impact?"] },
  { key: "risk_if_not_done", labels: ["What might happen if this is not done?"] },
  {
    key: "outcome",
    labels: [
      "How will we measure success? Mention the metrics expected to improve after release and how they will be tracked?",
      "How will we measure success?",
      "What outcome should improve once this goes live and where we would be tracking the outcome?",
    ],
  },
  { key: "module_owner", labels: ["Which Module Owner should be assigned to review this request?"] },
  { key: "stakeholder", labels: ["Please tag the stakeholder for this request?"] },
];

// Does this message look like an adhoc request at all?
export function isAdhocRequest(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("adhoc request")) return true;
  let count = 0;
  for (const q of QUESTIONS) {
    if (q.labels.some((l) => t.includes(l.toLowerCase().slice(0, 20)))) count++;
  }
  return count >= 3;
}

function clean(text: string): string {
  // Strip Slack mrkdwn emphasis + bullet glyphs; keep line breaks.
  return text
    .replace(/[*_~`]/g, "")
    .replace(/^[\s]*[•◦▪·-]\s*/gm, "")
    .replace(/\r/g, "");
}

function tidyAnswer(raw: string): string | null {
  const v = raw
    .replace(/^[\s:?-]+/, "") // leading colon / dash left over from the label line
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
  return v.length > 0 ? v : null;
}

export function parseAdhocMessage(text: string): AdhocFields {
  const body = clean(text);
  const lower = body.toLowerCase();

  // Find where each known question appears (earliest matching alias wins).
  const hits: { key: keyof AdhocFields; idx: number; len: number }[] = [];
  for (const q of QUESTIONS) {
    let bestIdx = -1;
    let bestLen = 0;
    for (const label of q.labels) {
      const i = lower.indexOf(label.toLowerCase());
      if (i >= 0 && (bestIdx === -1 || i < bestIdx)) {
        bestIdx = i;
        bestLen = label.length;
      }
    }
    if (bestIdx >= 0) hits.push({ key: q.key, idx: bestIdx, len: bestLen });
  }
  hits.sort((a, b) => a.idx - b.idx);

  const fields: AdhocFields = {
    raised_by: null,
    program: null,
    batch: null,
    module: null,
    beneficiary: null,
    problem: null,
    learners_impact: null,
    risk_if_not_done: null,
    outcome: null,
    module_owner: null,
    stakeholder: null,
  };

  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].idx + hits[i].len;
    const end = i + 1 < hits.length ? hits[i + 1].idx : body.length;
    fields[hits[i].key] = tidyAnswer(body.slice(start, end));
  }

  return fields;
}
