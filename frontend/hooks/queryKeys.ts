// Shared query keys to avoid circular dependencies between hooks

// Group Query Keys
export const groupKeys = {
  all: ["groups"] as const,
  lists: () => [...groupKeys.all, "list"] as const,
  list: () => [...groupKeys.lists()] as const,
  details: () => [...groupKeys.all, "detail"] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
  roundMembers: (groupId: string, roundId: string) =>
    [...groupKeys.all, "round-members", groupId, roundId] as const,
};

// Round Query Keys
export const roundKeys = {
  all: ["rounds"] as const,
  lists: () => [...roundKeys.all, "list"] as const,
  list: (groupId: string) => [...roundKeys.lists(), groupId] as const,
  details: () => [...roundKeys.all, "detail"] as const,
  detail: (id: string) => [...roundKeys.details(), id] as const,
};

// Message Query Keys
export const messageKeys = {
  all: ["messages"] as const,
  lists: () => [...messageKeys.all, "list"] as const,
  list: (groupId: string) => [...messageKeys.lists(), groupId] as const,
  infinite: (groupId: string) =>
    [...messageKeys.all, groupId, "infinite"] as const,
};
