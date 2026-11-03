#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip the build, exit 1 = build.
# Commits that only touch data/progress.json (the app's progress sync) don't need a
# new deployment. Anything else (vocab, exercises, code) is built as usual.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if git diff --quiet "$BASE" HEAD -- . ':(exclude)data/progress.json' 2>/dev/null; then
  echo "Only data/progress.json changed: skipping build."
  exit 0
fi
echo "Changes found: building."
exit 1
