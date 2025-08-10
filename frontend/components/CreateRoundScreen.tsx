import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useCreateRound, useRounds } from "../hooks/useRounds";
import { FormWrapper } from "./FormWrapper";

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
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createRoundMutation = useCreateRound();
  const { data: existingRounds } = useRounds(groupId);
  const isLoading = createRoundMutation.isPending;

  // Check if this is the first round
  const isFirstRound = !existingRounds || existingRounds.length === 0;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.theme.trim()) {
      newErrors.theme = "Theme is required";
    } else if (formData.theme.trim().length < 3) {
      newErrors.theme = "Theme must be at least 3 characters";
    }

    // Only validate start date for the first round
    if (isFirstRound) {
      if (!formData.startDate) {
        newErrors.startDate = "Start date is required";
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
      const submitData: any = {
        groupId,
        theme: formData.theme.trim(),
        description: formData.description.trim() || undefined,
      };

      // Only include start date for the first round
      if (isFirstRound) {
        // Create a date at midnight in the user's local timezone
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();
        const localMidnight = new Date(year, month, day);
        submitData.startDate = localMidnight.toISOString();
      }

      await createRoundMutation.mutateAsync(submitData);
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

  const handleDateChange = (
    event: DateTimePickerEvent,
    date: Date | undefined
  ) => {
    if (date) {
      setSelectedDate(date);
      // Format date in local timezone to avoid UTC conversion issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const localDateString = `${year}-${month}-${day}`;

      setFormData((prev) => ({
        ...prev,
        startDate: localDateString,
      }));
      console.log(localDateString);
    }
  };

  return (
    <FormWrapper title="Create Round" onClose={onCancel}>
      <View style={styles.section}>
        <Text style={styles.groupName}>in {groupName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Round Details</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Theme *</Text>
            <TextInput
              style={[styles.input, errors.theme && styles.inputError]}
              value={formData.theme}
              onChangeText={(text) => updateFormData("theme", text)}
              placeholder="e.g., 'Songs that make you happy'"
              placeholderTextColor="#666666"
              selectionColor="#FFB000"
              maxLength={100}
              returnKeyType="done"
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
              placeholderTextColor="#666666"
              selectionColor="#FFB000"
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
          </View>
        </View>
      </View>

      {isFirstRound ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.sectionSubtitle}>
            Set when the round starts. Voting and end dates will be calculated
            automatically based on your group settings.
          </Text>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Round Start Date *</Text>
              <View style={{ alignSelf: "stretch" }}>
                <DateTimePicker
                  testID="dateTimePicker"
                  minimumDate={new Date()}
                  value={selectedDate}
                  mode={"date"}
                  onChange={handleDateChange}
                  themeVariant="dark"
                  style={{
                    marginLeft: -10,
                  }}
                />
              </View>
              {errors.startDate && (
                <Text style={styles.errorText}>{errors.startDate}</Text>
              )}
              <Text style={styles.helpText}>
                When members can start submitting songs
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.autoTimelineInfo}>
            <Text style={styles.autoTimelineTitle}>Timeline</Text>
            <Text style={styles.autoTimelineText}>
              This round's timeline will be automatically calculated based on
              your group settings and the previous round's end date.
            </Text>
            <View style={styles.autoTimelineDetails}>
              <Text style={styles.autoTimelineDetail}>
                • Start: When the previous round ends
              </Text>
              <Text style={styles.autoTimelineDetail}>
                • Voting opens: After submission period ends
              </Text>
              <Text style={styles.autoTimelineDetail}>
                • End: When voting period ends
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
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
    </FormWrapper>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#282828",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#404040",
    padding: 16,
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
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#404040",
    marginTop: 24,
  },
  footerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  createButton: {
    flex: 1,
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
  cancelButton: {
    flex: 1,
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  autoTimelineInfo: {
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#404040",
  },
  autoTimelineTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  autoTimelineText: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 12,
  },
  autoTimelineDetails: {
    marginTop: 8,
  },
  autoTimelineDetail: {
    fontSize: 13,
    color: "#B3B3B3",
    marginBottom: 4,
  },
});
