#!/usr/bin/env bash
# Publish only a clean, already-merged main snapshot. Never force-push an artifact.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git diff --exit-code --quiet
git diff --cached --exit-code --quiet
git fetch origin main:refs/remotes/origin/main gh-pages:refs/remotes/origin/gh-pages
morph_source=$(git rev-parse HEAD)
if [ "$morph_source" != "$(git rev-parse origin/main)" ]; then
  echo 'Refusing to publish: HEAD must equal the remotely merged main commit.' >&2
  exit 1
fi
python3 - <<'PY'
import json,subprocess
marker=json.loads(subprocess.check_output(['git','show','origin/gh-pages:deployment.json']))
if marker.get('app')!='Morph Infinity 2.0': raise SystemExit('Refusing to replace an unrelated Pages branch.')
PY
npm run build -- --base=/Morph-Infinity-2.0/
python3 - <<'PY'
import json,pathlib,subprocess
root=pathlib.Path('dist');(root/'.nojekyll').touch()
(root/'deployment.json').write_text(json.dumps({'app':'Morph Infinity 2.0','sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'buildCommand':'npm run build -- --base=/Morph-Infinity-2.0/','hosting':'GitHub Pages','basePath':'/Morph-Infinity-2.0/'},indent=2)+'\n')
PY
morph_root=$PWD
morph_index_dir=$(mktemp -d /tmp/morph-pages-index.XXXXXX)
trap 'rm -f "$morph_index_dir/index"; rmdir "$morph_index_dir"' EXIT
export GIT_INDEX_FILE="$morph_index_dir/index"
git -C "$morph_root/dist" --git-dir="$morph_root/.git" --work-tree="$morph_root/dist" add --all -- .
morph_tree=$(git write-tree)
morph_parent=$(git rev-parse origin/gh-pages)
morph_artifact=$(printf 'deploy: deterministic simulations from %s\n' "$morph_source" | git commit-tree "$morph_tree" -p "$morph_parent")
unset GIT_INDEX_FILE
git push origin "$morph_artifact:refs/heads/gh-pages"
printf 'Published artifact %s from source %s\n' "$morph_artifact" "$morph_source"
