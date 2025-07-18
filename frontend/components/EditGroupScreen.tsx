import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useUpdateGroup } from "../hooks/useGroups";
import { FormWrapper } from "./FormWrapper";
import { Group } from "../types/api";

interface EditGroupScreenProps {
  group: Group;
  onGroupUpdated: (updatedGroup: Group) => void;
  onCancel: () => void;
}

export const EditGroupScreen: React.FC<EditGroupScreenProps> = ({
  group,
  onGroupUpdated,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    name: group.name,
    submissionDurationDays: group.submissionDurationDays,
    votingDurationDays: group.votingDurationDays,
    votesPerUserPerRound: group.votesPerUserPerRound,
    maxVotesPerSong: group.maxVotesPerSong,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateGroupMutation = useUpdateGroup();
  const isLoading = updateGroupMutation.isPending;

  // Check if any fields have changed from the original group data
  const hasChanges =
    formData.name !== group.name ||
    formData.submissionDurationDays !== group.submissionDurationDays ||
    formData.votingDurationDays !== group.votingDurationDays ||
    formData.votesPerUserPerRound !== group.votesPerUserPerRound ||
    formData.maxVotesPerSong !== group.maxVotesPerSong;

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
      const updatedGroup = await updateGroupMutation.mutateAsync({
        id: group.id,
        data: {
          name: formData.name.trim(),
          submissionDurationDays: formData.submissionDurationDays,
          votingDurationDays: formData.votingDurationDays,
          votesPerUserPerRound: formData.votesPerUserPerRound,
          maxVotesPerSong: formData.maxVotesPerSong,
        },
      });
      onGroupUpdated(updatedGroup);
    } catch (error) {
      Alert.alert("Error", "Failed to update group. Please try again.");
    }
  };

  const updateFormData = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <FormWrapper title="Edit Group" onClose={onCancel}>
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
          <Text style={styles.helpText}>How long members can submit songs</Text>
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
            <Text style={styles.errorText}>{errors.votesPerUserPerRound}</Text>
          )}
          <Text style={styles.helpText}>Total votes each member gets</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Max Votes per Song</Text>
          <TextInput
            style={[styles.input, errors.maxVotesPerSong && styles.inputError]}
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

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.updateButton,
            (isLoading || !hasChanges) && styles.updateButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading || !hasChanges}
        >
          {isLoading ? (
            <ActivityIndicator color="#191414" size="small" />
          ) : (
            <Text style={styles.updateButtonText}>
              {hasChanges ? "Update Group" : "No Changes"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </FormWrapper>
  );
};

const styles = StyleSheet.create({
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
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#404040",
    marginTop: 24,
  },
  updateButton: {
    backgroundColor: "#FFB000",
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: "#191414",
    fontSize: 16,
    fontWeight: "600",
  },
});
