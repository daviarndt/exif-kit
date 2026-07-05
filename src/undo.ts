/**
 * Restore files from the `_original` backups that ExifTool leaves behind.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const BACKUP_SUFFIX = "_original";

export interface RestorePlan {
  /** The edited file that will be replaced. */
  target: string;
  /** The `_original` backup that will be moved back over it. */
  backup: string;
}

/**
 * Build the restore plan for user inputs. Each input may be an edited file
 * (its backup is looked up), a `_original` backup itself, or a directory
 * (all backups directly inside it are restored).
 */
export function planRestore(inputs: string[]): RestorePlan[] {
  const plans = new Map<string, RestorePlan>();

  const addPair = (target: string, backup: string) => {
    plans.set(path.resolve(target), { target, backup });
  };

  for (const input of inputs) {
    const stat = fs.statSync(input, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      for (const entry of fs.readdirSync(input).sort()) {
        if (entry.endsWith(BACKUP_SUFFIX)) {
          const backup = path.join(input, entry);
          addPair(backup.slice(0, -BACKUP_SUFFIX.length), backup);
        }
      }
    } else if (input.endsWith(BACKUP_SUFFIX) && stat?.isFile()) {
      addPair(input.slice(0, -BACKUP_SUFFIX.length), input);
    } else {
      const backup = input + BACKUP_SUFFIX;
      if (!fs.existsSync(backup)) {
        throw new Error(
          `No backup found for "${input}" (expected "${backup}"). ` +
            "Backups are only kept when files are edited without --no-backup.",
        );
      }
      addPair(input, backup);
    }
  }
  return [...plans.values()];
}

/** Execute a restore plan: move each backup back over the edited file. */
export function restore(plans: RestorePlan[]): void {
  for (const { target, backup } of plans) {
    fs.renameSync(backup, target);
  }
}
