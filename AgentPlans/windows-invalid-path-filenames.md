# Fix 552 backslash filenames so the repo checks out on Windows

## Context

This repo cannot be fully checked out on Windows. `origin/main` contains **552 tracked files whose
names literally contain backslashes**:

```
frontend/imagecache/<server>/talent-backgrounds/interface\talentframe\<name>.webp
```

That is one filename, not three directory levels. Git on Windows rejects it as an invalid path, so
the checkout aborts and the index is left inconsistent. The current workaround in
`g:\DevStuff\GitHub\Chronicle\chronicle` is a sparse-checkout rule in `.git/info/sparse-checkout`
(`!/frontend/imagecache/*/talent-backgrounds/`) which just hides the whole directory.

Distribution (all in `origin/main`, all names already lowercase, one shared prefix
`interface\talentframe\`):

| dir | files |
|---|---|
| `frontend/imagecache/azerothcore/talent-backgrounds/` | 120 |
| `frontend/imagecache/kronos/talent-backgrounds/` | 108 |
| `frontend/imagecache/octowow/talent-backgrounds/` | 108 |
| `frontend/imagecache/turtle/talent-backgrounds/` | 108 |
| `frontend/imagecache/vanillaplus/talent-backgrounds/` | 108 |

Stripping the `interface\talentframe\` prefix yields **552 unique paths, zero collisions**
(verified against the `origin/main` tree).

**Root cause** — [extractloadingscreens.go:141-148](../scripts/dbcdata/cli/extractloadingscreens.go#L141-L148):

```go
const prefix = `Interface\Glues\LoadingScreens\`
name := strings.TrimPrefix(blpPath, prefix)
if name == blpPath {
    // Unexpected path format; use the full basename.
    name = filepath.Base(blpPath)
}
```

`extract-talent-backgrounds` ([extracttalentbg.go:98-113](../scripts/dbcdata/cli/extracttalentbg.go#L98-L113))
feeds `Interface\TalentFrame\<name>.blp` into the same helper. The loading-screens prefix does not
match, so it falls through to `filepath.Base`, which on Linux does **not** treat `\` as a separator
and returns the whole MPQ path. Running `make icons/talents-extract` on Linux/WSL therefore
produced 552 files named after their full MPQ path.

Outcome wanted: a branch on a personal fork where those 552 files carry plain basenames, plus the
extractor fix so regeneration cannot reintroduce them. Then a fresh clone on Windows works with no
sparse-checkout hacks.

## Why WSL

Only Linux can *create* files with `\` in the name, so only there can git materialise the current
tree and rename the files with `git mv`. The clone must live on the **Linux ext4 filesystem**
(`~/...`), never under `/mnt/g` or `/mnt/c` — DrvFs is backed by NTFS and rejects the same names
Windows does.

## Part A — WSL

### A1. Fork and clone

Fork `Emyrk/chronicle` on GitHub first (web UI), then:

```bash
cd ~
git clone https://github.com/<your-user>/chronicle.git chronicle-fix
cd chronicle-fix
git remote add upstream https://github.com/Emyrk/chronicle.git
git fetch upstream
git checkout -b fix/windows-invalid-paths upstream/main
```

Sanity check that the bad files actually materialised on disk:

```bash
git ls-files | grep -c '\\\\'      # expect 552 (git quotes the names, so the backslash is doubled)
ls frontend/imagecache/turtle/talent-backgrounds/ | head -3
```

If the count is 0 or the `ls` is empty, the clone is on `/mnt/...` — move it to `~`.

### A2. Rename the 552 files

```bash
git ls-files -z 'frontend/imagecache/*/talent-backgrounds/*' |
while IFS= read -r -d '' f; do
    case "$f" in *\\*) ;; *) continue ;; esac
    dir=${f%/*}          # frontend/imagecache/<server>/talent-backgrounds
    base=${f##*\\}       # everything after the last backslash
    git mv -- "$f" "$dir/$base"
done
```

`-z` is required: without it git quotes and escapes the names and the loop renames the wrong thing.
`${f%/*}` is safe because the last real `/` in the path is the one before `interface\...`.

Verify before committing:

```bash
git ls-files | grep -c '\\\\'                        # expect 0
git diff --cached --name-status | grep -c '^R'       # expect 552
git diff --cached -M --summary | head -3             # every line should be a 100% rename
git diff --cached --stat | tail -1                   # 0 insertions, 0 deletions
ls frontend/imagecache/azerothcore/talent-backgrounds/ | wc -l   # expect 120
```

Non-zero insertions/deletions means content changed — stop and investigate rather than commit.

Commit:

```
fix: flatten talent background filenames so Windows can check them out

The webp files under frontend/imagecache/*/talent-backgrounds/ were checked in
with literal backslashes in the name (interface\talentframe\foo.webp). Git on
Windows rejects those paths, so the whole repo fails to check out there.
Renamed all 552 down to the plain basename.
```

### A3. Fix the extractor

In [scripts/dbcdata/cli/extractloadingscreens.go](../scripts/dbcdata/cli/extractloadingscreens.go),
replace the block at lines 141-148 with:

```go
	// MPQ paths use Windows separators, and filepath.Base won't split those on Linux.
	normalized := strings.ReplaceAll(blpPath, `\`, "/")
	name := strings.TrimPrefix(normalized, `Interface/Glues/LoadingScreens/`)
	if name == normalized {
		name = path.Base(normalized)
	}
	name = strings.TrimSuffix(strings.ToLower(name), ".blp") + ".webp"
	outPath := filepath.Join(outDir, name)
```

Import `path`; keep `path/filepath` (`filepath.Join` above still uses it). Loading-screen
extraction keeps working: its prefix still matches after normalisation.

```bash
gofmt -l scripts/dbcdata/cli/
go build ./scripts/...
go vet ./scripts/dbcdata/...
```

Commit:

```
fix: split MPQ paths on backslash when naming extracted images

filepath.Base doesn't treat \ as a separator on Linux, so
extract-talent-backgrounds wrote the entire MPQ path out as one filename.
Normalize to / before taking the base.
```

### A4. Push

```bash
git push -u origin fix/windows-invalid-paths
```

Open the PR against `Emyrk/chronicle:main` if you want it upstream. GitHub renders this as 552
renames plus one small Go diff.

## Part B — Windows, fresh clone

```powershell
cd g:\DevStuff\GitHub\Chronicle
git clone -b fix/windows-invalid-paths https://github.com/<your-user>/chronicle.git chronicle-fixed
```

No sparse-checkout, no `core.protectNTFS` change needed. Then verify:

```powershell
cd g:\DevStuff\GitHub\Chronicle\chronicle-fixed
git status --porcelain          # expect empty
(Get-ChildItem frontend\imagecache\azerothcore\talent-backgrounds).Count   # expect 120
git config core.sparseCheckout  # expect nothing
```

Local work to carry over from the old `chronicle` checkout, if you want it: commit `c77f2900`
("Configuration + changes to integrate Chronicle with Azerothcore server", 9 files) plus the 10
staged deletions currently sitting in the index there. `git format-patch -1 c77f2900` in the old
repo and `git am` in the new one is the cleanest route. Keep the old directory around until you
have confirmed everything you need moved over.

Do **not** `git checkout main` in the fixed clone: upstream `main` still has the bad paths and will
fail the same way. Stay on the fix branch until upstream merges it.

## Verification

1. `git ls-files | Select-String '\\\\'` in the Windows clone returns nothing.
2. The five `talent-backgrounds` directories are populated (120/108/108/108/108) and each file
   opens as a valid webp.
3. In WSL: `make icons/talents-extract SERVER=azerothcore` (needs a WoW client + DBC path) writes
   `deathknightblood-topleft.webp` style names, not `interface\talentframe\...`. Skip this if no
   client is available; `go build ./scripts/...` plus reading the diff is enough.
4. Frontend build still passes: `cd frontend/chronicle && npm run build`.

## Flag, out of scope

`talentBackgroundUrl` in [iconUrl.ts:18-22](../frontend/chronicle/src/config/iconUrl.ts#L18-L22)
requests `<base>/talent-backgrounds/<backgroundFile>.webp` — a bare tab name such as
`deathknightblood.webp`, with no `-topleft` quadrant suffix. Nothing in the checked-in set matches
that shape either before or after the rename, so talent backgrounds are likely already broken on
the CDN, and this rename neither fixes nor worsens it. Separately, the rename changes the R2 object
keys produced by `frontend/imagecache/upload-talent-bg-r2.sh`, so a re-upload is needed before the
new names are live. Both are separate pieces of work.
