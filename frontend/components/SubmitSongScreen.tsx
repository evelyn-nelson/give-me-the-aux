import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useSpotifySearch, SpotifyTrack } from "../hooks/useSpotify";
import {
  useCreateSubmission,
  useUpdateSubmission,
} from "../hooks/useSubmissions";
import { Round, Group, Submission } from "../types/api";
import { FormWrapper } from "./FormWrapper";

interface SubmitSongScreenProps {
  round: Round;
  group: Group;
  onBack: () => void;
  onSuccess?: () => void;
  existingSubmission?: Submission | null;
}

export const SubmitSongScreen: React.FC<SubmitSongScreenProps> = ({
  round,
  group,
  onBack,
  onSuccess,
  existingSubmission,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSubmissionMutation = useCreateSubmission();
  const updateSubmissionMutation = useUpdateSubmission();

  const isEditing = !!existingSubmission;

  // Pre-populate with existing submission data when editing
  useEffect(() => {
    if (existingSubmission) {
      const track: SpotifyTrack = {
        id: existingSubmission.spotifyTrackId,
        name: existingSubmission.trackName,
        artists: [existingSubmission.artistName],
        album: existingSubmission.albumName,
        imageUrl: existingSubmission.imageUrl || "",
        spotifyUrl: existingSubmission.spotifyUrl,
        previewUrl: existingSubmission.previewUrl || undefined,
        durationMs: 0, // We don't store duration, so use a default
      };
      setSelectedTrack(track);
      setComment(existingSubmission.comment || "");
    }
  }, [existingSubmission]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search for tracks with debounced query
  const searchParams = {
    q: debouncedSearchQuery,
    limit: 20,
    market: "US",
  };

  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
  } = useSpotifySearch(searchParams, debouncedSearchQuery.length > 2);

  // Extract tracks array from response
  const tracks = searchResults?.data || [];

  const handleTrackSelect = useCallback((track: SpotifyTrack) => {
    setSelectedTrack(track);
    // Clear search results to show selected track
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, []);

  const handleSubmit = async () => {
    if (!selectedTrack) {
      Alert.alert("Error", "Please select a song to submit");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to submit a song");
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionData = {
        roundId: round.id,
        spotifyTrackId: selectedTrack.id,
        trackName: selectedTrack.name,
        artistName: selectedTrack.artists.join(", "),
        albumName: selectedTrack.album,
        imageUrl: selectedTrack.imageUrl,
        spotifyUrl: selectedTrack.spotifyUrl,
        previewUrl: selectedTrack.previewUrl,
        comment: comment.trim() || undefined,
      };

      if (isEditing) {
        await updateSubmissionMutation.mutateAsync(submissionData);
      } else {
        await createSubmissionMutation.mutateAsync(submissionData);
      }

      const successMessage = isEditing
        ? "Your song has been updated successfully!"
        : "Your song has been submitted successfully!";

      onSuccess?.();
      onBack();
    } catch (error) {
      console.error("Submission error:", error);
      const errorMessage = isEditing
        ? "Failed to update song. Please try again."
        : "Failed to submit song. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const renderSearchResult = ({ item: track }: { item: SpotifyTrack }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleTrackSelect(track)}
      activeOpacity={0.7}
    >
      <View style={styles.trackInfo}>
        {track.imageUrl ? (
          <Image source={{ uri: track.imageUrl }} style={styles.trackImage} />
        ) : (
          <View style={[styles.trackImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>♪</Text>
          </View>
        )}
        <View style={styles.trackDetails}>
          <Text style={styles.trackName} numberOfLines={2}>
            {track.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {track.artists.join(", ")}
          </Text>
          <Text style={styles.albumName} numberOfLines={1}>
            {track.album}
          </Text>
        </View>
      </View>
      <Text style={styles.duration}>{formatDuration(track.durationMs)}</Text>
    </TouchableOpacity>
  );

  const renderSelectedTrack = () => {
    if (!selectedTrack) return null;

    return (
      <View style={styles.selectedTrackContainer}>
        <Text style={styles.selectedTrackTitle}>Selected Song:</Text>
        <View style={styles.selectedTrackCard}>
          {selectedTrack.imageUrl && (
            <Image
              source={{ uri: selectedTrack.imageUrl }}
              style={styles.selectedTrackImage}
            />
          )}
          <View style={styles.selectedTrackDetails}>
            <Text style={styles.selectedTrackName} numberOfLines={2}>
              {selectedTrack.name}
            </Text>
            <Text style={styles.selectedTrackArtist} numberOfLines={1}>
              {selectedTrack.artists.join(", ")}
            </Text>
            <Text style={styles.selectedTrackAlbum} numberOfLines={1}>
              {selectedTrack.album}
            </Text>
            <Text style={styles.selectedTrackDuration}>
              {formatDuration(selectedTrack.durationMs)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FormWrapper
      title={isEditing ? "Edit Song" : "Submit Song"}
      onClose={onBack}
    >
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Round Info */}
          <View style={styles.roundInfo}>
            <Text style={styles.roundTheme}>{round.theme}</Text>
            {round.description && (
              <Text style={styles.roundDescription}>{round.description}</Text>
            )}
          </View>

          {/* Search Section */}
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Search for a Song</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for songs, artists, or albums..."
              placeholderTextColor="#666666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Search Results */}
          {(searchQuery.length > 2 || debouncedSearchQuery.length > 2) && (
            <View style={styles.searchResultsSection}>
              {isSearching ||
              (searchQuery.length > 2 &&
                searchQuery !== debouncedSearchQuery) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFB000" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : searchError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    Failed to search. Please try again.
                  </Text>
                </View>
              ) : tracks && tracks.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>
                    Found {tracks.length} results:
                  </Text>
                  <FlatList
                    data={tracks}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </>
              ) : debouncedSearchQuery.length > 2 ? (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No songs found</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Selected Track */}
          {renderSelectedTrack()}

          {/* Comment Section */}
          {selectedTrack && (
            <View style={styles.commentSection}>
              <Text style={styles.sectionTitle}>Add a Comment (Optional)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Share why you chose this song..."
                placeholderTextColor="#666666"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.characterCount}>
                {comment.length}/500 characters
              </Text>
            </View>
          )}

          {/* Submit Button */}
          {selectedTrack && (
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#191414" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditing ? "Update Song" : "Submit Song"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </FormWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#191414",
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#FFB000",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  roundInfo: {
    backgroundColor: "#282828",
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#404040",
  },
  roundTheme: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  roundDescription: {
    fontSize: 16,
    color: "#B3B3B3",
    lineHeight: 22,
  },
  searchSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "white",
  },
  searchResultsSection: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#B3B3B3",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#E53E3E",
    textAlign: "center",
  },
  noResultsContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: "#B3B3B3",
  },
  searchResultItem: {
    backgroundColor: "#282828",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#404040",
  },
  trackInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  trackImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  imagePlaceholder: {
    backgroundColor: "#404040",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#B3B3B3",
    fontSize: 20,
    fontWeight: "bold",
  },
  trackDetails: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    color: "#FFB000",
    marginBottom: 2,
  },
  albumName: {
    fontSize: 12,
    color: "#B3B3B3",
  },
  duration: {
    fontSize: 14,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  selectedTrackContainer: {
    marginBottom: 20,
  },
  selectedTrackTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 12,
  },
  selectedTrackCard: {
    backgroundColor: "#282828",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#404040",
  },
  selectedTrackImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  selectedTrackDetails: {
    flex: 1,
  },
  selectedTrackName: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  selectedTrackArtist: {
    fontSize: 16,
    color: "#FFB000",
    marginBottom: 2,
  },
  selectedTrackAlbum: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 4,
  },
  selectedTrackDuration: {
    fontSize: 14,
    color: "#FFB000",
    fontWeight: "500",
  },
  commentSection: {
    marginBottom: 20,
  },
  commentInput: {
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "white",
    minHeight: 80,
    maxHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    color: "#B3B3B3",
    textAlign: "right",
    marginTop: 8,
  },

  submitButton: {
    backgroundColor: "#FFB000",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: "#666666",
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#191414",
  },
});
