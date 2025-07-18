// Shared API types for the music voting app

export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Vote {
  id: string;
  count: number;
  comment?: string;
  user: User;
}

export interface Submission {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  imageUrl?: string;
  user: User;
  votes: Vote[];
}

export interface Round {
  id: string;
  theme: string;
  description?: string;
  status: "SUBMISSION" | "VOTING" | "COMPLETED";
  startDate: string;
  endDate: string;
  votingStartDate: string;
  order: number;
  group: {
    id: string;
    name: string;
    admin: User;
    votesPerUserPerRound: number;
    maxVotesPerSong: number;
  };
  submissions: Submission[];
  _count: {
    submissions: number;
  };
}

export interface Group {
  id: string;
  name: string;
  adminId: string;
  submissionDurationDays: number;
  votingDurationDays: number;
  votesPerUserPerRound: number;
  maxVotesPerSong: number;
  createdAt: string;
  admin: User;
  members: Array<{ user: User }>;
  rounds: Round[];
  _count: {
    members: number;
    rounds: number;
  };
}

// API Request/Response types
export interface CreateGroupData {
  name: string;
  submissionDurationDays?: number;
  votingDurationDays?: number;
  votesPerUserPerRound?: number;
  maxVotesPerSong?: number;
}

export interface UpdateGroupData {
  name?: string;
  submissionDurationDays?: number;
  votingDurationDays?: number;
  votesPerUserPerRound?: number;
  maxVotesPerSong?: number;
}

export interface CreateRoundData {
  groupId: string;
  theme: string;
  description?: string;
  startDate: string;
  endDate: string;
  votingStartDate: string;
  order?: number;
}

export interface UpdateRoundData {
  theme?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  votingStartDate?: string;
  status?: "SUBMISSION" | "VOTING" | "COMPLETED";
  order?: number;
}

export interface CreateSubmissionData {
  roundId: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  imageUrl?: string;
}

export interface CreateVoteData {
  submissionId: string;
  count: number;
  comment?: string;
}

export interface ReorderRoundsData {
  roundOrders: Array<{ roundId: string; newOrder: number }>;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code?: string;
}
