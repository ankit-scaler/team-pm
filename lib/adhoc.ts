// -----------------------------------------------------------------------------
//  Adhoc request parsing (Task 3)
//  The Instructor-flow workflow posts a fixed Q&A form into
//  #instructor-adhoc-request-1. We parse each message into structured fields by
//  using the known question labels as delimiters — robust to bullet/formatting
//  differences, and tolerant of missing questions.
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
const QUESTIONS: { key: keyof AdhocFields; label: string }[] = [
  { key: "raised_by", label: "Raised by" },
  { key: "program", label: "For which program we are raising this for?" },
  { key: "batch", label: "Could you please confirm which batch is this required for?" },
  { key: "module", label: "Can you highlight for which module we are solving for in the respective program?" },
  { key: "beneficiary", label: "Who will benefit from this?" },
  { key: "problem", label: "What problem are we trying to solve?" },
  { key: "learners_impact", label: "How many learners will this impact?" },
  { key: "risk_if_not_done", label: "What might happen if this is not done?" },
  { key: "outcome", label: "What outcome should improve once this goes live and where we would be tracking the outcome?" },
  { key: "module_owner", label: "Which Module Owner should be assigned to review this request?" },
  { key: "stakeholder", label: "Please tag the stakeholder for this request?" },
];

// Does this message look like an adhoc request at all?
export function isAdhocRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("adhoc request") ||
    QUESTIONS.filter((q) => t.includes(q.label.toLowerCase().slice(0, 20))).length >= 3
  );
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

  // Find where each known question appears.
  const hits = QUESTIONS.map((q) => {
    const idx = lower.indexOf(q.label.toLowerCase());
    return { key: q.key, label: q.label, idx };
  })
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

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
    const start = hits[i].idx + hits[i].label.length;
    const end = i + 1 < hits.length ? hits[i + 1].idx : body.length;
    fields[hits[i].key] = tidyAnswer(body.slice(start, end));
  }

  return fields;
}
