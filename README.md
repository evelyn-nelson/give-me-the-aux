# give-me-the-aux

competitive music sharing game

Users can create groups and invite their friends. In these groups, every few days, every user will submit a song matching some theme set by the group admin. Then, over the next few days, everybody will vote on which songs they like best. I haven't decided which music streaming service this should connect to yet, but ultimately users will sign in using oauth to connect their account (probably spotify, apple music, or youtube, but I think ultimately i should choose only one), and by the end of the game (after many rounds), the user with the most votes on their songs will win. Each group will also have text chat functionality without too many features. Long polling is acceptable for chat because the main point of the game is just to share music.

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
