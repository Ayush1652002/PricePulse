#!/usr/bin/env bash
# Removes junk and dead code from Git (P-08, P-23, P-07).
# Run from the ROOT of the repository (the folder that contains backend/ and frontend/).
# It uses "git rm". Before committing you can undo it with: git reset --hard  (only if you have no other uncommitted work).
set -u

if [ ! -d backend ] || [ ! -d frontend ] || [ ! -d .git ]; then
  echo "Run this from the repository root (the folder with backend/, frontend/ and .git)."
  exit 1
fi

echo "This will remove AI-tool folders, zip files and dead code from Git."
read -r -p "Continue? (y/N) " answer
[ "$answer" = "y" ] || { echo "Cancelled."; exit 0; }

# 1) Folders/files that must not be in the repository. --cached keeps your local copy on disk.
git rm -r --cached --ignore-unmatch --quiet \
  backend/.claude backend/.windsurf backend/.agents backend/skills-lock.json \
  backend/backend.zip frontend/frontend.zip

# 2) Dead code that nothing imports (checked by reading the code).
#    "git rm -f" also deletes these files from disk (-f because they may show local changes).
git rm -f --ignore-unmatch --quiet \
  backend/src/services/email.service.ts \
  backend/src/services/ebay-product.service.ts \
  backend/src/services/ebay-token.service.ts \
  backend/src/providers/ebay.provider.ts \
  backend/src/providers/marketplace.provider.ts \
  backend/src/services/marketplaces/ebay.adapter.ts \
  frontend/src/App.css \
  frontend/src/assets/react.svg \
  frontend/src/assets/vite.svg \
  frontend/src/assets/hero.png

echo
echo "Done. Review with:  git status"
echo "Then commit with:   git commit -m \"chore: remove junk files and dead code\""
