import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FormScreenProps = {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  scrollable?: boolean;
};

export const FormWrapper: React.FC<FormScreenProps> = ({
  children,
  title,
  onClose,
  scrollable = true,
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const dismissKeyboardAndClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  // Adjust keyboard offset for iOS
  const keyboardOffset = Platform.OS === "ios" ? 100 : 0;

  const ContentWrapper = scrollable ? ScrollView : View;

  const contentProps = scrollable
    ? {
        ref: scrollViewRef,
        keyboardShouldPersistTaps: "handled" as const,
        showsVerticalScrollIndicator: false,
        contentContainerStyle: { paddingBottom: 16 },
        keyboardDismissMode: "interactive" as const,
      }
    : {};

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={keyboardOffset}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={dismissKeyboardAndClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.placeholder} />
          </View>
        </View>

        {/* Content */}
        <ContentWrapper style={styles.content} {...contentProps}>
          {children}
        </ContentWrapper>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 20,
    paddingBottom: 15,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
});
