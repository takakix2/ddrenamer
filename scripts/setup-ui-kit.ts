/**
 * Put `src/ui-kit` in place.
 *
 * The design system lives in its own repository (Lethe_UI_Kit) and is shared
 * by five apps. On a development machine it sits next to this one, and the
 * useful arrangement is a symlink: edit the kit, and every app sees it at
 * once. That symlink used to be committed -- which meant the repository only
 * built on machines that already had the surrounding tree. A fresh clone, and
 * therefore CI and anyone else, got a dangling link and a TypeScript error
 * about a missing module.
 *
 * So the link is no longer tracked, and this script produces it:
 *
 *   1. already there and usable  -> leave it alone
 *   2. sibling checkout present  -> symlink to it (keeps live editing)
 *   3. neither                   -> clone the public mirror
 *
 * Runs from `postinstall`, so `bun install` is enough to make the repo
 * buildable from nothing.
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, symlinkSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(repoRoot, "src", "ui-kit");
const sibling = resolve(repoRoot, "..", "Lethe_UI_Kit");
const MIRROR = "https://github.com/takakix2/Lethe_UI_Kit.git";

/** A file every arrangement must end up providing. Presence of the directory
 *  is not enough: a dangling symlink still passes `existsSync` on its own. */
const WITNESS = join("themes", "_variables.css");

function usable(dir: string): boolean {
  return existsSync(join(dir, WITNESS));
}

function report(how: string) {
  console.log(`ui-kit: ${how}`);
}

if (usable(target)) {
  report("already in place");
  process.exit(0);
}

// A link that exists but does not resolve is worse than nothing -- it is the
// exact state that broke CI -- so clear it before choosing an arrangement.
if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
  rmSync(target, { recursive: true, force: true });
  report("removed a stale entry");
}

mkdirSync(dirname(target), { recursive: true });

if (usable(sibling)) {
  // Relative, never absolute: an absolute path breaks the moment the tree is
  // moved, and the failure mode is a silently unstyled window.
  symlinkSync(join("..", "..", "Lethe_UI_Kit"), target, "dir");
  report(`symlinked to the checkout next door (${sibling})`);
} else {
  report(`no checkout next door, cloning ${MIRROR}`);
  const cloned = spawnSync("git", ["clone", "--depth", "1", MIRROR, target], {
    stdio: "inherit",
  });
  if (cloned.status !== 0) {
    console.error("ui-kit: clone failed");
    process.exit(1);
  }
}

if (!usable(target)) {
  console.error(`ui-kit: still missing ${WITNESS} after setup`);
  process.exit(1);
}
report("ready");
