<task>
Review all commits in the current branch since the merge base with the main branch. Identify over-engineering patterns and AUTOMATICALLY IMPLEMENT the most impactful simplifications to make the code more "grug brain" friendly - favoring simplicity, directness, and avoiding unnecessary complexity.
</task>

<context>
You are helping to simplify code and reduce over-engineering. Focus on identifying:
- Unnecessary abstractions
- Over-complex patterns when simple solutions exist
- Features that could be simplified without losing value
- Code that prioritizes cleverness over clarity
</context>

<workflow>
Follow these stages strictly in order:

**Stage 1: Pre-flight Checks**
1. Use Bash tool: `git status` to check for outstanding changes
2. If there are staged or unstaged changes, inform user and ask if they want to commit for clean state
3. Find merge base: `git merge-base HEAD main || git merge-base HEAD master`
4. Get commit range: `git log --oneline <merge-base>..HEAD`

**Stage 2: Analyze Commits for Over-Engineering**
1. Display: "Analyzing commits for over-engineering patterns..."
2. For each commit in range, use `git show <commit>` to examine changes
3. Parse code changes and identify over-engineering patterns based on analysis criteria
4. Filter out trivial changes and focus on impactful simplifications

**Stage 3: Create TODO List**
1. Prioritize simplifications by impact (highest first): deep nesting fixes, unnecessary abstractions, etc.
2. Use TodoWrite tool to add TODOs for each simplification opportunity
3. Group similar patterns together where applicable

**Stage 4: Mode Selection**
Ask user:
```
Found X simplification opportunities. How would you like to proceed?
(a) Interactive: Review and approve each simplification
(b) Automatic: Implement all high-impact simplifications
```

**Stage 5: Implementation (based on mode)**

*Interactive Mode:*
For each TODO item:
1. Show the over-engineered code with context
2. Show proposed simplified version with explanation
3. Explain why this simplification follows "grug brain" principles
4. Ask:
   ```
   Implement simplification for **<pattern type in file:line>** as described above?
   Options: (y)es / (s)kip / describe alternative approach / ask questions
   ```
5. Wait for user reply before proceeding
6. If user answers yes: implement change and commit with clear message
7. Continue to next TODO item

*Automatic Mode:*
1. Implement all high-impact simplifications in priority order
2. Create focused commit for each major simplification
3. Show progress as changes are made

**Stage 6: Quality Check & Wrap-up**
1. Run linter/formatter if available in project
2. Print summary table:
   ```
   Simplification | File | Pattern | Commit SHA | Impact
   ```
3. End with: "Code simplification complete. Your code is now more grug brain friendly!"
</workflow>

<analysis_criteria>
Look for these over-engineering patterns:
- Deep nesting instead of early returns
- Complex abstractions for simple operations
- Premature optimization
- Excessive configuration options
- Generic solutions for specific problems
- Clever code that's hard to understand
- Multiple layers of indirection
- Feature creep in simple functions
</analysis_criteria>

<implementation_approach>
1. **Analysis Phase**: Review commits and identify over-engineering
2. **Implementation Phase**: Actually make the changes, prioritizing:
   - Convert deep nesting to early returns (highest impact)
   - Remove unnecessary abstractions
   - Simplify complex conditionals
   - Extract overly clever code to readable versions
3. **Documentation Phase**: Commit changes with clear messages about WHY each simplification helps

For each simplification made:

## Simplified: [File] - [What was changed]

### Before (Over-engineered):
```[language]
[original complex code]
```

### After (Grug Brain Friendly):
```[language]
[simplified code]
```

### Why This is Better:
- [Specific benefit: readability, maintainability, etc.]
</implementation_approach>

<grug_brain_principles>
- Simple is better than clever
- Explicit is better than implicit
- Readable trumps concise
- Solve the problem at hand, not future problems
- Happy path should be obvious
- Errors should exit early
- Avoid deep nesting
- Functions should do one thing well
</grug_brain_principles>