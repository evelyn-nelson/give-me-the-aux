# Spotify API Routes Documentation

This document describes the enhanced Spotify API routes available in the Give Me The Aux backend.

## Authentication

All routes require authentication via the `requireAuth` middleware. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

All routes are protected by user-specific rate limiting to prevent abuse of the Spotify API.

## Routes

### 1. Search Tracks

**Endpoint:** `GET /api/spotify/search`

Search for tracks using the Spotify Web API.

**Query Parameters:**

- `q` (required): Search query string
- `limit` (optional): Number of results to return (1-50, default: 20)
- `offset` (optional): Number of results to skip (default: 0)
- `market` (optional): Country code for market-specific results (default: "US")

**Example Request:**

```
GET /api/spotify/search?q=bohemian+rhapsody&limit=10&offset=0
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "3z8h0TU7ReDPLIbEnYhWZb",
      "name": "Bohemian Rhapsody",
      "artists": ["Queen"],
      "album": "A Night at the Opera",
      "imageUrl": "https://i.scdn.co/image/ab67616d0000b273ce4f1737e8c849399a8c3a4f",
      "previewUrl": "https://p.scdn.co/mp3-preview/...",
      "spotifyUrl": "https://open.spotify.com/track/3z8h0TU7ReDPLIbEnYhWZb",
      "durationMs": 354000
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid query parameter
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Spotify API error

### 2. Get Track by ID

**Endpoint:** `GET /api/spotify/tracks/:id`

Get detailed information about a specific track.

**Path Parameters:**

- `id` (required): Spotify track ID

**Example Request:**

```
GET /api/spotify/tracks/3z8h0TU7ReDPLIbEnYhWZb
```

**Example Response:**

```json
{
  "data": {
    "id": "3z8h0TU7ReDPLIbEnYhWZb",
    "name": "Bohemian Rhapsody",
    "artists": ["Queen"],
    "album": "A Night at the Opera",
    "imageUrl": "https://i.scdn.co/image/ab67616d0000b273ce4f1737e8c849399a8c3a4f",
    "previewUrl": "https://p.scdn.co/mp3-preview/...",
    "spotifyUrl": "https://open.spotify.com/track/3z8h0TU7ReDPLIbEnYhWZb",
    "durationMs": 354000
  }
}
```

**Error Responses:**

- `400 Bad Request`: Missing track ID
- `404 Not Found`: Track not found
- `500 Internal Server Error`: Spotify API error

### 3. Get Multiple Tracks

**Endpoint:** `GET /api/spotify/tracks`

Get detailed information about multiple tracks by their IDs.

**Query Parameters:**

- `ids` (required): Comma-separated list of Spotify track IDs (max 50)

**Example Request:**

```
GET /api/spotify/tracks?ids=3z8h0TU7ReDPLIbEnYhWZb,4iJyoBOLtHqaGxP12qzhQI
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "3z8h0TU7ReDPLIbEnYhWZb",
      "name": "Bohemian Rhapsody",
      "artists": ["Queen"],
      "album": "A Night at the Opera",
      "imageUrl": "https://i.scdn.co/image/ab67616d0000b273ce4f1737e8c849399a8c3a4f",
      "previewUrl": "https://p.scdn.co/mp3-preview/...",
      "spotifyUrl": "https://open.spotify.com/track/3z8h0TU7ReDPLIbEnYhWZb",
      "durationMs": 354000
    },
    {
      "id": "4iJyoBOLtHqaGxP12qzhQI",
      "name": "Another One Bites the Dust",
      "artists": ["Queen"],
      "album": "The Game",
      "imageUrl": "https://i.scdn.co/image/ab67616d0000b273...",
      "previewUrl": "https://p.scdn.co/mp3-preview/...",
      "spotifyUrl": "https://open.spotify.com/track/4iJyoBOLtHqaGxP12qzhQI",
      "durationMs": 213000
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid track IDs
- `500 Internal Server Error`: Spotify API error

### 4. Get Track Audio Features

**Endpoint:** `GET /api/spotify/tracks/:id/features`

Get audio features for a specific track (danceability, energy, etc.).

**Path Parameters:**

- `id` (required): Spotify track ID

**Example Request:**

```
GET /api/spotify/tracks/3z8h0TU7ReDPLIbEnYhWZb/features
```

**Example Response:**

```json
{
  "data": {
    "id": "3z8h0TU7ReDPLIbEnYhWZb",
    "acousticness": 0.123,
    "danceability": 0.456,
    "energy": 0.789,
    "instrumentalness": 0.012,
    "key": 5,
    "liveness": 0.345,
    "loudness": -8.123,
    "mode": 1,
    "speechiness": 0.067,
    "tempo": 120.5,
    "timeSignature": 4,
    "valence": 0.234
  }
}
```

**Audio Features Explained:**

- `acousticness`: Confidence measure from 0.0 to 1.0 of whether the track is acoustic
- `danceability`: How suitable a track is for dancing (0.0 to 1.0)
- `energy`: Perceptual measure of intensity and activity (0.0 to 1.0)
- `instrumentalness`: Predicts whether a track contains no vocals (0.0 to 1.0)
- `key`: The key the track is in (0-11, C=0, C#=1, etc.)
- `liveness`: Detects the presence of an audience (0.0 to 1.0)
- `loudness`: Overall loudness in decibels (typically -60 to 0)
- `mode`: Modality (major=1, minor=0)
- `speechiness`: Presence of spoken words (0.0 to 1.0)
- `tempo`: Overall estimated tempo in BPM
- `timeSignature`: Estimated time signature
- `valence`: Musical positiveness (0.0 to 1.0)

**Error Responses:**

- `400 Bad Request`: Missing track ID
- `500 Internal Server Error`: Spotify API error

## Usage Examples

### Frontend Integration

```typescript
// Search for tracks
const searchTracks = async (query: string, limit = 20) => {
  const response = await fetch(
    `/api/spotify/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Get track details
const getTrack = async (trackId: string) => {
  const response = await fetch(`/api/spotify/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};

// Get multiple tracks
const getTracks = async (trackIds: string[]) => {
  const response = await fetch(
    `/api/spotify/tracks?ids=${trackIds.join(",")}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};
```

### Error Handling

```typescript
try {
  const result = await searchTracks("queen");
  if (result.data) {
    // Handle successful response
    console.log(result.data);
  }
} catch (error) {
  if (error.status === 429) {
    // Handle rate limiting
    console.log("Rate limit exceeded, please try again later");
  } else if (error.status === 400) {
    // Handle bad request
    console.log("Invalid search query");
  } else {
    // Handle other errors
    console.log("Search failed");
  }
}
```

## Rate Limiting

The Spotify API has rate limits that are enforced by the backend:

- 100 requests per hour per user for search endpoints
- 1000 requests per hour per user for track endpoints

When rate limits are exceeded, the API returns a 429 status code with an appropriate error message.

## Market-Specific Results

The search endpoint supports market-specific results using the `market` parameter. This ensures that tracks are available in the specified market and may affect the order of results.

Common market codes:

- `US`: United States
- `GB`: Great Britain
- `CA`: Canada
- `AU`: Australia
- `DE`: Germany

## Notes

- All track IDs returned are Spotify track IDs that can be used with other Spotify API endpoints
- Preview URLs are 30-second preview clips that may not be available for all tracks
- Image URLs are high-quality album artwork
- Duration is provided in milliseconds
- Audio features are only available for tracks that have been analyzed by Spotify
