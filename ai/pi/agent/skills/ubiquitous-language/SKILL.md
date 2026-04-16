---
name: ubiquitous-language
description: Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. Saves to UBIQUITOUS_LANGUAGE.md. Use when user wants to define domain terms, build a glossary, harden terminology, or mentions "domain model" or "DDD".
---

# Ubiquitous Language

Extract and formalize domain terminology from the current conversation into a consistent glossary.

## Process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts
2. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words for same concept (synonyms)
   - Vague or overloaded terms
3. **Propose a canonical glossary** with opinionated term choices
4. **Write to `UBIQUITOUS_LANGUAGE.md`** in the working directory
5. **Output a summary** inline

## Output Format

```md
# Ubiquitous Language

## <Domain Group>

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Order** | A customer's request to purchase one or more items | Purchase, transaction |

## Relationships

- An **Invoice** belongs to exactly one **Customer**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — only once **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — recommend distinguishing these
```

## Rules

- **Be opinionated.** Pick the best term, list others as aliases to avoid.
- **Flag conflicts explicitly.** Call out ambiguous usage with clear recommendations.
- **Only domain terms.** Skip generic programming concepts unless they have domain-specific meaning.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships** with bold term names and cardinality.
- **Group into multiple tables** when natural clusters emerge.
- **Write an example dialogue** (3-5 exchanges) showing terms used precisely.

## Re-running

When invoked again in the same conversation:
1. Read existing `UBIQUITOUS_LANGUAGE.md`
2. Incorporate new terms
3. Update definitions if understanding evolved
4. Re-flag new ambiguities
5. Rewrite example dialogue to incorporate new terms
