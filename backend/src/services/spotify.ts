import SpotifyWebApi from "spotify-web-api-node";
import { AuthService } from "./auth";

export class SpotifyService {
  private spotifyApi: SpotifyWebApi;

  constructor(accessToken?: string) {
    this.spotifyApi = AuthService.createSpotifyApi();
    if (accessToken) {
      this.spotifyApi.setAccessToken(accessToken);
    }
  }

  async searchTracks(
    query: string,
    limit = 20,
    offset = 0,
    type = "track",
    market = "US"
  ) {
    try {
      const response = await this.spotifyApi.searchTracks(query, {
        limit,
        offset,
        market,
      });

      return (
        response.body.tracks?.items.map((track: any) => ({
          id: track.id,
          name: track.name,
          artists: track.artists.map((artist: any) => artist.name),
          album: track.album.name,
          imageUrl: track.album.images[0]?.url,
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls.spotify,
          durationMs: track.duration_ms,
        })) || []
      );
    } catch (error) {
      console.error("Spotify search error:", error);
      throw new Error("Failed to search tracks");
    }
  }

  async getTrack(trackId: string) {
    try {
      const response = await this.spotifyApi.getTrack(trackId);
      const track = response.body;

      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name),
        album: track.album.name,
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify,
        durationMs: track.duration_ms,
      };
    } catch (error) {
      console.error("Spotify get track error:", error);
      throw new Error("Failed to get track");
    }
  }

  async getTracks(trackIds: string[]) {
    try {
      const response = await this.spotifyApi.getTracks(trackIds);

      return response.body.tracks.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => artist.name),
        album: track.album.name,
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify,
        durationMs: track.duration_ms,
      }));
    } catch (error) {
      console.error("Spotify get tracks error:", error);
      throw new Error("Failed to get tracks");
    }
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPublic = false
  ) {
    try {
      const response = await this.spotifyApi.createPlaylist(name, {
        description,
        public: isPublic,
      });
      return response.body;
    } catch (error) {
      console.error("Spotify create playlist error:", error);
      throw new Error("Failed to create playlist");
    }
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[]) {
    try {
      const response = await this.spotifyApi.addTracksToPlaylist(
        playlistId,
        trackUris
      );
      return response.body;
    } catch (error) {
      console.error("Spotify add tracks error:", error);
      throw new Error("Failed to add tracks to playlist");
    }
  }
}
