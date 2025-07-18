# give-me-the-aux

competitive music sharing game

Users can create groups and invite their friends. In these groups, every few days, every user will submit a song matching some theme set by the group admin. Then, over the next few days, everybody will vote on which songs they like best. I haven't decided which music streaming service this should connect to yet, but ultimately users will sign in using oauth to connect their account (probably spotify, apple music, or youtube, but I think ultimately i should choose only one), and by the end of the game (after many rounds), the user with the most votes on their songs will win. Each group will also have text chat functionality without too many features. Long polling is acceptable for chat because the main point of the game is just to share music.

## Authentication

This app uses **Spotify OAuth 2.0 with PKCE** for secure user authentication. The authentication flow is designed for mobile apps and includes token refresh capabilities.

### How Authentication Works

1. **Initial Login Flow**:

   - User taps "Login with Spotify" in the app
   - App opens Spotify's authorization page in a web browser
   - User authorizes the app to access their Spotify account
   - Spotify redirects back to the app with an authorization code
   - App sends the code + PKCE verifier to the backend
   - Backend exchanges the code for Spotify access/refresh tokens
   - Backend creates or updates user in database
   - Backend generates JWT access token + refresh token pair
   - App stores tokens securely using Expo SecureStore

2. **Token Management**:

   - **Access Token**: JWT token valid for 7 days, used for API requests
   - **Refresh Token**: Secure random string valid for 30 days, used to get new access tokens
   - **Spotify Tokens**: Stored in database, automatically refreshed when needed

3. **Security Features**:

   - **PKCE (Proof Key for Code Exchange)**: Prevents authorization code interception attacks
   - **Token Rotation**: Each refresh generates new refresh token, old one is revoked
   - **Secure Storage**: Tokens stored using Expo SecureStore (iOS Keychain/Android Keystore)
   - **Rate Limiting**: Login attempts and token refresh are rate-limited
   - **Automatic Token Refresh**: Spotify tokens refreshed 5 minutes before expiry

4. **API Authentication**:

   - All protected API endpoints require `Authorization: Bearer <jwt_token>` header
   - Backend validates JWT and attaches user info to request
   - Failed auth returns 401 status with error message

5. **Logout Process**:
   - App calls logout endpoint to revoke all refresh tokens
   - App clears stored tokens from SecureStore
   - User must re-authenticate to access protected features

### Technical Implementation

**Frontend (React Native + Expo)**:

- Uses `expo-auth-session` for OAuth flow
- Custom redirect URI: `givemetheaux://auth`
- `AuthContext` manages authentication state
- Automatic token refresh on API 401 responses
- Secure token storage with `expo-secure-store`

**Backend (Node.js + Express)**:

- Handles OAuth code exchange with Spotify API
- JWT generation and validation using `jsonwebtoken`
- Refresh token management with database storage
- Rate limiting with `express-rate-limit`
- Middleware for protected route authentication

**Database (PostgreSQL + Prisma)**:

- User table stores Spotify profile info and tokens
- RefreshToken table for secure token rotation
- Automatic cleanup of expired tokens

### Environment Variables Required

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
JWT_SECRET=your_jwt_signing_secret
```

### Spotify App Configuration

1. Create a Spotify app at https://developer.spotify.com/dashboard
2. Add redirect URI: `givemetheaux://auth`
3. Request scopes: `user-read-email`, `user-read-private`, `playlist-modify-public`, `playlist-modify-private`, `user-library-read`

list of libraries

- frontend
  @react-navigation/native
  @react-navigation/stack
  @react-navigation/bottom-tabs
  react-native-screens
  react-native-safe-area-context
  @tanstack/react-query
  react-hook-form
  expo-auth-session
  expo-crypto
  expo-notifications
  expo-linking
  expo-constants

- backend
  express
  cors
  helmet
  jsonwebtoken
  bcrypt
  prisma
  @prisma/client
  dotenv
  axios

commands

# Generate Prisma client

docker compose --profile tools run --rm prisma generate

# Push database schema

docker compose --profile tools run --rm prisma db push

# Open Prisma Studio (optional)

docker compose --profile tools run --rm -p 5555:5555 prisma studio --hostname 0.0.0.0
