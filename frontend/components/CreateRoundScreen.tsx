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
import { useCreateRound } from "../hooks/useRounds";

interface CreateRoundScreenProps {
  groupId: string;
  groupName: string;
  onRoundCreated: () => void;
  onCancel: () => void;
}

export const CreateRoundScreen: React.FC<CreateRoundScreenProps> = ({
  groupId,
  groupName,
  onRoundCreated,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    theme: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    votingStartDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createRoundMutation = useCreateRound();
  const isLoading = createRoundMutation.isPending;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.theme.trim()) {
      newErrors.theme = "Theme is required";
    } else if (formData.theme.trim().length < 3) {
      newErrors.theme = "Theme must be at least 3 characters";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }

    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    }

    if (!formData.votingStartDate) {
      newErrors.votingStartDate = "Voting start date is required";
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        newErrors.endDate = "End date must be after start date";
      }
    }

    if (formData.startDate && formData.votingStartDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const votingStart = new Date(formData.votingStartDate);
      const end = new Date(formData.endDate);

      if (votingStart < start) {
        newErrors.votingStartDate = "Voting start must be after round start";
      }

      if (votingStart >= end) {
        newErrors.votingStartDate = "Voting start must be before round end";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await createRoundMutation.mutateAsync({
        groupId,
        theme: formData.theme.trim(),
        description: formData.description.trim() || undefined,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        votingStartDate: new Date(formData.votingStartDate).toISOString(),
      });
      onRoundCreated();
    } catch (error) {
      Alert.alert("Error", "Failed to create round. Please try again.");
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const getMinDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const getMinVotingDate = () => {
    return formData.startDate || getMinDate();
  };

  const getMaxVotingDate = () => {
    if (!formData.endDate) return undefined;
    const endDate = new Date(formData.endDate);
    endDate.setDate(endDate.getDate() - 1);
    return endDate.toISOString().split("T")[0];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Round</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.groupName}>in {groupName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Round Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Theme *</Text>
            <TextInput
              style={[styles.input, errors.theme && styles.inputError]}
              value={formData.theme}
              onChangeText={(text) => updateFormData("theme", text)}
              placeholder="e.g., 'Songs that make you happy'"
              placeholderTextColor="#666"
              maxLength={100}
            />
            {errors.theme && (
              <Text style={styles.errorText}>{errors.theme}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.textArea, errors.description && styles.inputError]}
              value={formData.description}
              onChangeText={(text) => updateFormData("description", text)}
              placeholder="Add more details about this round..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.sectionSubtitle}>
            Set when the round starts, when voting begins, and when it ends
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Round Start Date *</Text>
            <TextInput
              style={[styles.input, errors.startDate && styles.inputError]}
              value={formData.startDate}
              onChangeText={(text) => updateFormData("startDate", text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />
            {errors.startDate && (
              <Text style={styles.errorText}>{errors.startDate}</Text>
            )}
            <Text style={styles.helpText}>
              When members can start submitting songs
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Voting Start Date *</Text>
            <TextInput
              style={[
                styles.input,
                errors.votingStartDate && styles.inputError,
              ]}
              value={formData.votingStartDate}
              onChangeText={(text) => updateFormData("votingStartDate", text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />
            {errors.votingStartDate && (
              <Text style={styles.errorText}>{errors.votingStartDate}</Text>
            )}
            <Text style={styles.helpText}>
              When voting opens and submissions close
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Round End Date *</Text>
            <TextInput
              style={[styles.input, errors.endDate && styles.inputError]}
              value={formData.endDate}
              onChangeText={(text) => updateFormData("endDate", text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />
            {errors.endDate && (
              <Text style={styles.errorText}>{errors.endDate}</Text>
            )}
            <Text style={styles.helpText}>
              When voting closes and round completes
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.timelinePreview}>
            <Text style={styles.timelineTitle}>Timeline Preview</Text>
            <View style={styles.timelineItem}>
              <View
                style={[styles.timelineDot, { backgroundColor: "#FFB000" }]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Submissions Open</Text>
                <Text style={styles.timelineDate}>
                  {formData.startDate
                    ? new Date(formData.startDate).toLocaleDateString()
                    : "Start date"}
                </Text>
              </View>
            </View>
            <View style={styles.timelineItem}>
              <View
                style={[styles.timelineDot, { backgroundColor: "#FF8C00" }]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Voting Opens</Text>
                <Text style={styles.timelineDate}>
                  {formData.votingStartDate
                    ? new Date(formData.votingStartDate).toLocaleDateString()
                    : "Voting start date"}
                </Text>
              </View>
            </View>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: "#666" }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Round Ends</Text>
                <Text style={styles.timelineDate}>
                  {formData.endDate
                    ? new Date(formData.endDate).toLocaleDateString()
                    : "End date"}
                </Text>
              </View>
            </View>
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
            <Text style={styles.createButtonText}>Create Round</Text>
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
  groupName: {
    fontSize: 16,
    color: "#FFB000",
    fontWeight: "500",
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
  textArea: {
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "white",
    height: 80,
    textAlignVertical: "top",
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
  timelinePreview: {
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#404040",
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "white",
  },
  timelineDate: {
    fontSize: 12,
    color: "#B3B3B3",
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
