/**
 * Groups instances by duplicate_group_id.
 * Instances without a group stay as solo entries.
 * Returns an array of instance groups (each group is an array of 1+ instances).
 * Within each group, order is preserved from the input.
 */
export function groupDuplicateInstances<
  T extends { id: string; duplicate_group_id?: string },
>(instances: T[]): T[][] {
  const groups = new Map<string, T[]>();
  const result: T[][] = [];

  for (const inst of instances) {
    const key = inst.duplicate_group_id;
    if (key) {
      let group = groups.get(key);
      if (!group) {
        group = [];
        groups.set(key, group);
        result.push(group);
      }
      group.push(inst);
    } else {
      result.push([inst]);
    }
  }

  return result;
}
