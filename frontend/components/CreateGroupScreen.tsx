import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useCreateGroup } from "../hooks/useGroups";

interface CreateGroupScreenProps {
  onGroupCreated: () => void;
  onCancel: () => void;
}

export const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({
  onGroupCreated,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    submissionDurationDays: 3,
    votingDurationDays: 2,
    votesPerUserPerRound: 10,
    maxVotesPerSong: 3,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createGroupMutation = useCreateGroup();
  const isLoading = createGroupMutation.isPending;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Group name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Group name must be at least 2 characters";
    }

    if (
      formData.submissionDurationDays < 1 ||
      formData.submissionDurationDays > 30
    ) {
      newErrors.submissionDurationDays = "Must be between 1 and 30 days";
    }

    if (formData.votingDurationDays < 1 || formData.votingDurationDays > 14) {
      newErrors.votingDurationDays = "Must be between 1 and 14 days";
    }

    if (
      formData.votesPerUserPerRound < 1 ||
      formData.votesPerUserPerRound > 50
    ) {
      newErrors.votesPerUserPerRound = "Must be between 1 and 50 votes";
    }

    if (formData.maxVotesPerSong < 1 || formData.maxVotesPerSong > 10) {
      newErrors.maxVotesPerSong = "Must be between 1 and 10 votes";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await createGroupMutation.mutateAsync({
        name: formData.name.trim(),
        submissionDurationDays: formData.submissionDurationDays,
        votingDurationDays: formData.votingDurationDays,
        votesPerUserPerRound: formData.votesPerUserPerRound,
        maxVotesPerSong: formData.maxVotesPerSong,
      });
      onGroupCreated();
    } catch (error) {
      Alert.alert("Error", "Failed to create group. Please try again.");
    }
  };

  const updateFormData = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Group</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => updateFormData("name", text)}
              placeholder="Enter group name"
              placeholderTextColor="#666"
              maxLength={50}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voting Settings</Text>
          <Text style={styles.sectionSubtitle}>
            Configure how long rounds last and voting limits
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Submission Duration (days)</Text>
            <TextInput
              style={[
                styles.input,
                errors.submissionDurationDays && styles.inputError,
              ]}
              value={formData.submissionDurationDays.toString()}
              onChangeText={(text) =>
                updateFormData("submissionDurationDays", parseInt(text) || "")
              }
              placeholder="3"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            {errors.submissionDurationDays && (
              <Text style={styles.errorText}>
                {errors.submissionDurationDays}
              </Text>
            )}
            <Text style={styles.helpText}>
              How long members can submit songs
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Voting Duration (days)</Text>
            <TextInput
              style={[
                styles.input,
                errors.votingDurationDays && styles.inputError,
              ]}
              value={formData.votingDurationDays.toString()}
              onChangeText={(text) =>
                updateFormData("votingDurationDays", parseInt(text) || "")
              }
              placeholder="2"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            {errors.votingDurationDays && (
              <Text style={styles.errorText}>{errors.votingDurationDays}</Text>
            )}
            <Text style={styles.helpText}>How long members can vote</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Votes per User per Round</Text>
            <TextInput
              style={[
                styles.input,
                errors.votesPerUserPerRound && styles.inputError,
              ]}
              value={formData.votesPerUserPerRound.toString()}
              onChangeText={(text) =>
                updateFormData("votesPerUserPerRound", parseInt(text) || "")
              }
              placeholder="10"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            {errors.votesPerUserPerRound && (
              <Text style={styles.errorText}>
                {errors.votesPerUserPerRound}
              </Text>
            )}
            <Text style={styles.helpText}>Total votes each member gets</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Max Votes per Song</Text>
            <TextInput
              style={[
                styles.input,
                errors.maxVotesPerSong && styles.inputError,
              ]}
              value={formData.maxVotesPerSong.toString()}
              onChangeText={(text) =>
                updateFormData("maxVotesPerSong", parseInt(text) || "")
              }
              placeholder="3"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            {errors.maxVotesPerSong && (
              <Text style={styles.errorText}>{errors.maxVotesPerSong}</Text>
            )}
            <Text style={styles.helpText}>
              Maximum votes one song can receive from a user
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            isLoading && styles.createButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#191414" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  cancelText: {
    fontSize: 16,
    color: "#FFB000",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  placeholder: {
    width: 50,
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "white",
  },
  inputError: {
    borderColor: "#E53E3E",
  },
  errorText: {
    fontSize: 14,
    color: "#E53E3E",
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: "#B3B3B3",
    marginTop: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#404040",
  },
  createButton: {
    backgroundColor: "#FFB000",
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#191414",
    fontSize: 16,
    fontWeight: "600",
  },
});
