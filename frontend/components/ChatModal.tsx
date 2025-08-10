import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Component,
  ErrorInfo,
  ReactNode,
} from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  KeyboardEventName,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useInfiniteMessages, useCreateMessage } from "../hooks/useMessages";
import { Message } from "../types/api";

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

// Error boundary to catch crashes
class ChatErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Chat Modal Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.container}>
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Chat temporarily unavailable</Text>
              <Text style={styles.errorSubtext}>
                Please try again in a moment
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  this.setState({ hasError: false });
                  this.props.onClose();
                }}
              >
                <Text style={styles.retryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    return this.props.children;
  }
}

const ChatModalCore: React.FC<ChatModalProps> = ({
  visible,
  onClose,
  groupId,
  groupName,
}) => {
  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList<Message>>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const shouldScrollOnNextContentSizeChangeRef = useRef<boolean>(false);
  const initialAutoScrollDoneRef = useRef<boolean>(false);
  const isScrollingRef = useRef<boolean>(false);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessages(groupId, 50, visible); // Pass visible state for smart polling

  const createMessageMutation = useCreateMessage();

  // Flatten pages in correct chronological order
  // Backend returns: Page 1 = [newest...51st], Page 2 = [50th...1st]
  // We want: [1st, 2nd, ..., newest] (chronological order)
  const messages = data?.pages.slice().reverse().flat() || [];
  // For inverted FlatList, newest should be first in the array so index 0 == bottom
  const invertedData = messages.slice().reverse();

  // Track previous message count to detect new arrivals
  const previousMessageCountRef = useRef<number>(0);

  // Cleanup on modal close
  useEffect(() => {
    if (!visible) {
      setInputText("");
      setShouldAutoScroll(true);
      setIsLoadingMore(false);
      setIsKeyboardVisible(false);
      previousMessageCountRef.current = 0;
      shouldScrollOnNextContentSizeChangeRef.current = false;
      initialAutoScrollDoneRef.current = false;
      isScrollingRef.current = false;
    }
  }, [visible]);

  // Single scroll to bottom function with safety checks and deduping
  const scrollToBottomSafely = useCallback(
    (animated: boolean = false, useDoubleRaf: boolean = false) => {
      if (!messages.length) return;
      if (isScrollingRef.current) return;
      const doScroll = () => {
        try {
          isScrollingRef.current = true;
          flatListRef.current?.scrollToIndex({
            index: 0,
            animated,
            viewPosition: 0,
          });
          // allow subsequent scrolls after a short window to avoid rapid double-scrolls
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 120);
        } catch (err) {
          console.warn("Scroll error:", err);
          isScrollingRef.current = false;
        }
      };
      if (useDoubleRaf) {
        requestAnimationFrame(() => requestAnimationFrame(doScroll));
      } else {
        requestAnimationFrame(doScroll);
      }
      // Extra safety: also schedule a late retry after layout settles
      setTimeout(() => {
        if (!isScrollingRef.current) {
          try {
            flatListRef.current?.scrollToIndex({
              index: 0,
              animated: false,
              viewPosition: 0,
            });
          } catch {}
        }
      }, 80);
    },
    [messages.length]
  );

  // Helper: robust scroll when keyboard opens (avoid layout races)
  const scrollForKeyboardOpen = useCallback(() => {
    scrollToBottomSafely(false, true);
  }, [scrollToBottomSafely]);

  // Keyboard listeners: simplify to reduce duplicate triggers
  useEffect(() => {
    if (!visible) return;

    const showEvent: KeyboardEventName =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent: KeyboardEventName =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      setShouldAutoScroll(true);
      scrollForKeyboardOpen();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, scrollForKeyboardOpen]);

  // After keyboard visibility flips to true, try another scroll once more
  useEffect(() => {
    if (!visible || !isKeyboardVisible) return;
    scrollForKeyboardOpen();
  }, [visible, isKeyboardVisible, scrollForKeyboardOpen]);

  // On new messages, set a flag to scroll on next content size change to avoid double scrolls
  useEffect(() => {
    if (!visible) return;
    const prev = previousMessageCountRef.current;
    const hasNew = messages.length > prev;

    // Initial load: trigger one-time auto scroll
    if (
      prev === 0 &&
      messages.length > 0 &&
      !initialAutoScrollDoneRef.current
    ) {
      shouldScrollOnNextContentSizeChangeRef.current = true;
    }

    if (hasNew && shouldAutoScroll && !isLoadingMore && !isFetchingNextPage) {
      shouldScrollOnNextContentSizeChangeRef.current = true;
    }

    previousMessageCountRef.current = messages.length;
  }, [
    messages.length,
    visible,
    shouldAutoScroll,
    isLoadingMore,
    isFetchingNextPage,
  ]);

  // Detect whether user is near the bottom to toggle auto-scroll
  const SCROLL_BOTTOM_THRESHOLD_PX = 60;
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // With inverted FlatList, bottom is near offset 0
      const { contentOffset } = event.nativeEvent;
      const atBottom = contentOffset.y <= SCROLL_BOTTOM_THRESHOLD_PX;
      setShouldAutoScroll(atBottom);
    },
    []
  );

  // Centralized auto-scroll trigger used by onLayout and onContentSizeChange
  const attemptAutoScroll = useCallback(() => {
    if (!visible) return;
    if (!messages.length) return;

    if (shouldAutoScroll && shouldScrollOnNextContentSizeChangeRef.current) {
      shouldScrollOnNextContentSizeChangeRef.current = false;
      if (!initialAutoScrollDoneRef.current) {
        initialAutoScrollDoneRef.current = true;
      }
      scrollToBottomSafely(false, true);
    }
  }, [visible, messages.length, shouldAutoScroll, scrollToBottomSafely]);

  const handleSendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? inputText).trim();
    if (!content) return;

    try {
      // Clear immediately for responsive feel + against autocorrect composition
      setInputText("");
      textInputRef.current?.clear();
      textInputRef.current?.setNativeProps({ text: "" });
      if (isKeyboardVisible) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => textInputRef.current?.focus())
        );
      }

      // Enable auto-scroll and defer actual scroll until content size updates
      setShouldAutoScroll(true);
      shouldScrollOnNextContentSizeChangeRef.current = true;

      await createMessageMutation.mutateAsync({
        groupId,
        content,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to send message. Please try again.");
      setInputText(content); // Restore text on error
    }
  };

  const handleLoadMoreMessages = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      setIsLoadingMore(true);
      setShouldAutoScroll(false); // Don't auto-scroll when loading history
      try {
        await fetchNextPage();
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  };

  const renderMessage = ({ item: message }: { item: Message }) => {
    const isOwnMessage = message.user.id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <View style={styles.messageHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {message.user.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.senderName}>{message.user.displayName}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {message.content}
          </Text>
        </View>
        <Text
          style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
          ]}
        >
          {formatTime(message.createdAt)}
        </Text>
      </View>
    );
  };

  const renderLoadMoreButton = () => {
    if (!hasNextPage) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={handleLoadMoreMessages}
          disabled={isFetchingNextPage || isLoadingMore}
        >
          {isFetchingNextPage || isLoadingMore ? (
            <ActivityIndicator size="small" color="#FFB000" />
          ) : (
            <Text style={styles.loadMoreText}>Load Older Messages</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{groupName} Chat</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 84 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFB000" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load messages</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => onClose()}
              >
                <Text style={styles.retryText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={invertedData}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              showsVerticalScrollIndicator={false}
              inverted
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 20,
              }}
              initialNumToRender={15}
              maxToRenderPerBatch={20}
              windowSize={10}
              updateCellsBatchingPeriod={100}
              ListFooterComponent={renderLoadMoreButton}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              removeClippedSubviews={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              bounces={false}
              overScrollMode="never"
              onScrollToIndexFailed={() => {
                // Retry after measurements are available
                setTimeout(() => scrollToBottomSafely(false, true), 60);
              }}
              onLayout={() => {
                attemptAutoScroll();
              }}
              onContentSizeChange={() => {
                attemptAutoScroll();
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Start the conversation!
                  </Text>
                </View>
              }
            />
          )}

          <View style={styles.inputContainer}>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#666666"
              value={inputText}
              onChangeText={(text) => {
                // On iOS, intercept return to send instead of inserting newline
                if (Platform.OS === "ios" && text.endsWith("\n")) {
                  const withoutNewline = text.replace(/\n+$/g, "");
                  const content = withoutNewline.trim();
                  if (content.length > 0) {
                    setInputText("");
                    handleSendMessage(content);
                  } else {
                    setInputText("");
                  }
                  return;
                }
                setInputText(text);
              }}
              onFocus={() => {
                setShouldAutoScroll(true);
                scrollForKeyboardOpen();
              }}
              maxLength={1000}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
              enablesReturnKeyAutomatically
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim()
                  ? styles.sendButtonActive
                  : styles.sendButtonInactive,
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || createMessageMutation.isPending}
            >
              {createMessageMutation.isPending ? (
                <ActivityIndicator size="small" color="#191414" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// Export wrapped component with error boundary
export const ChatModal: React.FC<ChatModalProps> = (props) => {
  return (
    <ChatErrorBoundary onClose={props.onClose}>
      <ChatModalCore {...props} />
    </ChatErrorBoundary>
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
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 24,
    color: "#B3B3B3",
    fontWeight: "300",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#B3B3B3",
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#E53E3E",
    marginBottom: 16,
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryText: {
    color: "#191414",
    fontSize: 16,
    fontWeight: "600",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 20,
    paddingBottom: 10,
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  loadMoreButton: {
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 150,
    alignItems: "center",
  },
  loadMoreText: {
    color: "#FFB000",
    fontSize: 14,
    fontWeight: "500",
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: "80%",
  },
  ownMessage: {
    alignSelf: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFB000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#191414",
  },
  senderName: {
    fontSize: 12,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  ownMessageBubble: {
    backgroundColor: "#FFB000",
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#282828",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#191414",
  },
  otherMessageText: {
    color: "white",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: "#B3B3B3",
    textAlign: "right",
  },
  otherMessageTime: {
    color: "#666666",
    textAlign: "left",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#404040",
    backgroundColor: "#191414",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "white",
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonActive: {
    backgroundColor: "#FFB000",
  },
  sendButtonInactive: {
    backgroundColor: "#404040",
  },
  sendButtonText: {
    color: "#191414",
    fontSize: 16,
    fontWeight: "600",
  },
});
