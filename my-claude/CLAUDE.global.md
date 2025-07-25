
## Always important
- When working on code or features, please be sure to commit at each step with useful messages, and validate changes with tests, and write new tests if needed. Make commits small & focused to allow for easier review. Avoid commenting on obvious code. You're a star so I expect the best mate! <3 Don't forget to run the linter before committing too


## Search Tools
- Use `fd` instead of find for file discovery:
  - `fd -e java -e kt MockTrip projects/dora` (find files by name and extension)
  - `fd -t f pattern path` (files only)
- Use `rg` (ripgrep) for content search:
  - `rg -t java -t kotlin "pattern" path` (search by file type)
  - `rg -l "pattern" path` (list files with matches only)
  - `rg "^package.*pattern"` (anchor to line start)
  - `rg "class.*pattern|interface.*pattern"` (multiple patterns with OR)
- Use `tree` for directory structure viewing


## Line of Sight Code Style Guidelines
Align the happy path to the left edge - Normal execution flow at left margin, errors/edge cases indented.

Rules
1. Early Exit Pattern
- Exit early on errors/invalid conditions
- Flip if statements to avoid else blocks
- Handle errors immediately when they occur

2. Structure
- Happy path flows down the left edge
- Happy return statement on the last line
- Extract complex logic into separate functions
- Keep function bodies small

3. Avoid Deep Nesting
Instead of:
```go
if something.OK() {
    // happy path logic nested
    return nil
} else {
    return errors.New("not ok")
}
```

Do:
```go
if !something.OK() {
    return errors.New("not ok")
}
// happy path logic at left margin
return nil
```
4. Complex Conditionals

Extract switch/case bodies into separate functions rather than inline logic.

Keep successful execution paths at the left margin. Handle errors with early returns. Avoid else blocks and deep nesting. Structure functions so main logic flows top-to-bottom without indentation.
