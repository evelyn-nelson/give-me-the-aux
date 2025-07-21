import { useQuery, useMutation } from "@tanstack/react-query";
import { useApi } from "./useApi";

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  imageUrl?: string;
  previewUrl?: string;
  spotifyUrl: string;
  durationMs: number;
}

export interface SpotifySearchParams {
  q: string;
  limit?: number;
  offset?: number;
  market?: string;
}

export interface SpotifySearchResponse {
  data: SpotifyTrack[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Query Keys
export const spotifyKeys = {
  all: ["spotify"] as const,
  search: (params: SpotifySearchParams) =>
    [...spotifyKeys.all, "search", params] as const,
  track: (id: string) => [...spotifyKeys.all, "track", id] as const,
  tracks: (ids: string[]) => [...spotifyKeys.all, "tracks", ids] as const,
};

// Search tracks
export const useSpotifySearch = (
  params: SpotifySearchParams,
  enabled = true
) => {
  const api = useApi();

  return useQuery({
    queryKey: spotifyKeys.search(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        q: params.q,
        limit: (params.limit || 20).toString(),
        offset: (params.offset || 0).toString(),
        market: params.market || "US",
      });

      const response = await api.get(`/api/spotify/search?${searchParams}`);
      return response as SpotifySearchResponse;
    },
    enabled: enabled && !!params.q && params.q.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get single track
export const useSpotifyTrack = (trackId: string, enabled = true) => {
  const api = useApi();

  return useQuery({
    queryKey: spotifyKeys.track(trackId),
    queryFn: async () => {
      const response = await api.get(`/api/spotify/tracks/${trackId}`);
      return response.data as SpotifyTrack;
    },
    enabled: enabled && !!trackId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Get multiple tracks
export const useSpotifyTracks = (trackIds: string[], enabled = true) => {
  const api = useApi();

  return useQuery({
    queryKey: spotifyKeys.tracks(trackIds),
    queryFn: async () => {
      const response = await api.get(
        `/api/spotify/tracks?ids=${trackIds.join(",")}`
      );
      return response.data as SpotifyTrack[];
    },
    enabled: enabled && trackIds.length > 0 && trackIds.length <= 50,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
