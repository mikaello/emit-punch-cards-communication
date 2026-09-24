# Repository guidance

Keep protocol descriptions generic and self-contained.
Avoid repository-specific data and individual card examples.

## Dependencies and quality

Install npm packages with `--save-exact`.
Run relevant tests, linting, formatting, and builds before pushing.
Fix test and lint failures before proceeding.
Prefer brevity in code and documentation.
Keep implementation scope tight, and ask before expanding it materially.

## Pull requests

Open a separate pull request for each unrelated feature or fix.
Combine changes in one pull request only when they directly serve the same outcome.

## Documentation

Keep documentation concise.
Write one sentence per line in Markdown.
Treat sentence-per-line as source formatting, not as a requirement to make every sentence its own paragraph.
Group related sentence lines into natural paragraphs, and use blank lines only for genuine paragraph breaks.
