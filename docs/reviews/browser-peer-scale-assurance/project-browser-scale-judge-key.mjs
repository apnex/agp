/** Projects a browser scale judge key; private reading roles never enter the returned object. */
export function projectScaleJudgeKey(authorKey, readingRole) {
  if (readingRole !== "baseline" && readingRole !== "candidate") {
    throw new Error("Browser scale judge key unknown reading role");
  }
  if (authorKey?.kind !== "browser-scale-answer-key" || !Array.isArray(authorKey.entries)) {
    throw new Error("Browser scale judge key invalid source");
  }
  const copyStrings = (values) => {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.length === 0)) {
      throw new Error("Browser scale judge key invalid text list");
    }
    return [...values];
  };
  const scoring = {};
  for (const score of ["0", "1", "2"]) {
    if (typeof authorKey.scoring?.[score] !== "string" || authorKey.scoring[score].length === 0) {
      throw new Error("Browser scale judge key invalid scoring definition");
    }
    scoring[score] = authorKey.scoring[score];
  }
  const seen = new Set();
  const entries = authorKey.entries.map((entry) => {
    if (typeof entry.id !== "string" || !/^Q\d{2}$/u.test(entry.id) || seen.has(entry.id)) {
      throw new Error("Browser scale judge key invalid question identifier");
    }
    seen.add(entry.id);
    const assigned = entry.byReading?.[readingRole];
    if (!assigned) throw new Error("Browser scale judge key missing assigned requirements");
    return {
      id: entry.id,
      required: [...copyStrings(entry.required), ...copyStrings(assigned.required)],
      wrong: copyStrings(entry.wrong),
      grounding: [...copyStrings(entry.grounding), ...copyStrings(assigned.grounding)],
    };
  });
  return { scoring, rules: copyStrings(authorKey.rules), entries };
}
