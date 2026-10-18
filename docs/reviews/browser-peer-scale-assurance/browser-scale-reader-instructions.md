# AGP intent reader instructions

Use only the supplied intent reading and questions.\
Do not open referenced documents, browse, execute code or use prior knowledge of AGP.

Answer all eight questions in order, using exactly `### Q01` through `### Q08` as headings.\
For each answer, separate the decision, document support, and any inference or gap.

Support positive claims with contiguous excerpts, each written as `QUOTE:` followed by one JSON string containing the supplied text.\
Whitespace may differ, but punctuation, identifiers and qualifiers must not.\
A justified absence claim may explain the relevant gap without inventing a quotation of absence.

Interpret the policy you received, not the policy you would prefer.\
Where a decision or quantity is not established, say so rather than filling it from experience.\
Clearly label a conclusion inferred from supplied premises rather than directly stated.

After the eight answers, use `### Observations` for ambiguities, contradictions or missing information not covered by the questions.\
Do not guess which version you received or rewrite it.\
Keep the whole response within 24 KiB of UTF-8 text; no answer has a preferred wording or quotation count.
