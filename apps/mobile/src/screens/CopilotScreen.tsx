import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStubCopilotResponse } from '../copilot/stubResponder';
import { radius, spacing, typography } from '../theme/tokens';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

const SUGGESTED_PROMPTS = [
  'What is this medication for?',
  'Can I take with food?',
  'What happens if I miss a dose?',
];

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CopilotScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const canSend = input.trim().length > 0 && !isTyping;

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, isTyping]);

  function appendMessage(message: ChatMessage) {
    setMessages((prev) => [...prev, message]);
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    appendMessage({
      id: createId('user'),
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
    });
    setInput('');
    setIsTyping(true);

    const reply = getStubCopilotResponse(trimmed);
    const delay = 700 + Math.floor(Math.random() * 500);

    setTimeout(() => {
      appendMessage({
        id: createId('assistant'),
        role: 'assistant',
        text: reply,
        createdAt: new Date().toISOString(),
      });
      setIsTyping(false);
    }, delay);
  }

  const typingDots = useMemo(() => (isTyping ? 'Copilot is typing...' : ''), [isTyping]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Copilot</Text>
        <Text style={styles.subtitle}>Ask about your medications</Text>
        <Text style={styles.privacyNote}>Private by default</Text>

        {messages.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyTitle}>Suggested prompts</Text>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Pressable key={prompt} style={styles.promptChip} onPress={() => sendMessage(prompt)}>
                <Text style={styles.promptChipText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    item.role === 'user' ? styles.userBubbleText : styles.assistantBubbleText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            )}
          />
        )}

        {isTyping ? (
          <Text style={styles.typingIndicator}>{typingDots}</Text>
        ) : null}
      </View>

      <View style={[styles.inputBarWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Copilot"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            multiline={false}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => sendMessage(input)}
          />
          <Pressable
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!canSend}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.subtitle,
    color: '#334155',
  },
  privacyNote: {
    fontSize: typography.caption,
    color: '#64748b',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  emptyStateCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  promptChip: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#ffffff',
  },
  promptChipText: {
    fontSize: typography.body,
    color: '#334155',
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingBottom: spacing.sm,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0f172a',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe2ea',
  },
  bubbleText: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#ffffff',
  },
  assistantBubbleText: {
    color: '#1f2937',
  },
  typingIndicator: {
    fontSize: typography.caption,
    color: '#64748b',
    marginBottom: spacing.sm,
  },
  inputBarWrap: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: typography.body,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  sendButton: {
    minHeight: 46,
    minWidth: 72,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
