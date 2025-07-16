# Backend API

## Rate Limiting

The backend implements rate limiting for authentication and API routes to prevent abuse and ensure service stability.

### Rate Limiting Configuration

#### Authentication Routes

- **Spotify OAuth Login** (`POST /api/auth/spotify`)

  - Limit: 5 attempts per 15 minutes per IP
  - Purpose: Prevent brute force attacks on login

- **Token Refresh** (`POST /api/auth/refresh`)

  - Limit: 10 attempts per 15 minutes per IP
  - Purpose: Prevent abuse of token refresh endpoint

- **User Profile** (`GET /api/auth/me`)

  - Limit: 50 requests per 15 minutes per user
  - Purpose: Prevent excessive profile requests

- **Logout** (`POST /api/auth/logout`)
  - Limit: 50 requests per 15 minutes per user
  - Purpose: Prevent abuse of logout endpoint

#### Spotify API Routes

- **Search Tracks** (`GET /api/spotify/search`)

  - Limit: 50 requests per 15 minutes per user
  - Purpose: Prevent excessive Spotify API usage

- **Get Track** (`GET /api/spotify/tracks/:id`)
  - Limit: 50 requests per 15 minutes per user
  - Purpose: Prevent excessive Spotify API usage

### Rate Limit Headers

When rate limits are exceeded, the API returns:

- HTTP 429 (Too Many Requests)
- `RateLimit-*` headers with limit information
- JSON response with error message and code

### Implementation Details

- Uses `express-rate-limit` middleware
- IP-based limiting for unauthenticated routes
- User ID-based limiting for authenticated routes
- 15-minute sliding windows
- Automatic cleanup of expired entries

### Error Response Format

```json
{
  "error": "Too many requests from this IP, please try again after 15 minutes",
  "code": "RATE_LIMIT_EXCEEDED"
}
```
