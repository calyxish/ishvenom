/**
 * Learn — Gemma 4 educational snake-safety chat.
 *
 * Features:
 *   - Text chat with formatted responses (bold, numbered lists)
 *   - Image upload: pick from gallery or camera, sent to Gemma 4 vision
 *   - Cloud badge when running via Google AI API
 *   - Keyboard handling via bottom padding animation on both platforms
 */
import { useRef, useCallback, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useSession } from '../../src/store/session';
import { useLearn } from '../../src/store/learn';
import { sendLearnMessage } from '../../src/lib/gemmaLearn';
import { useInferenceMode } from '../../src/hooks/useInferenceMode';
import { parseMarkdown } from '../../src/lib/formatResponse';
import type { ChatMessage } from '../../src/lib/gemmaLearn';
import type { Block, InlinePart } from '../../src/lib/formatResponse';

// ─── Inline text renderer ─────────────────────────────────────────────────────

function InlineText({
  parts,
  style,
}: {
  parts: InlinePart[];
  style?: object;
}) {
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.bold ? (
          <Text key={i} style={styles.bold}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function FormattedMessage({
  text,
  textStyle,
  colors,
}: {
  text: string;
  textStyle: object;
  colors: import('../../src/hooks/useTheme').ColorTokens;
}) {
  const blocks = parseMarkdown(text);
  return (
    <View style={styles.formattedBody}>
      {blocks.map((block: Block, i: number) => {
        if (block.type === 'h2') {
          return (
            <View key={i} style={[styles.headingRow, i > 0 && styles.headingTopMargin]}>
              <View style={[styles.headingAccent, { backgroundColor: colors.accentPrimary }]} />
              <Text style={[styles.h2, { color: colors.textPrimary }]}>
                {block.text}
              </Text>
            </View>
          );
        }
        if (block.type === 'h3') {
          return (
            <Text key={i} style={[styles.h3, { color: colors.accentSecondary }, i > 0 && styles.headingTopMargin]}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'numbered') {
          return (
            <View key={i} style={styles.numberedRow}>
              <Text style={[textStyle, styles.numberedIndex, { color: colors.accentSecondary }]}>
                {block.number}.
              </Text>
              <InlineText parts={block.parts} style={[textStyle, styles.numberedText]} />
            </View>
          );
        }
        return (
          <InlineText
            key={i}
            parts={block.parts}
            style={[textStyle, i > 0 && styles.paragraphSpacing]}
          />
        );
      })}
    </View>
  );
}

// ─── Chat bubble (own component — avoids Hermes closure bugs with FlatList) ───

function ChatBubble({
  item,
  index,
  copiedIndex,
  onCopy,
  colors,
}: {
  item: ChatMessage;
  index: number;
  copiedIndex: number | null;
  onCopy: (index: number, text: string) => void;
  colors: import('../../src/hooks/useTheme').ColorTokens;
}) {
  const isUser = item.role === 'user';
  const isCopied = copiedIndex === index;

  return (
    <View
      style={[
        styles.bubbleWrapper,
        isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
      ]}
    >
      <Pressable
        onLongPress={() => { if (!isUser) onCopy(index, item.text); }}
        delayLongPress={400}
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.accentPrimary }]
            : [
                styles.bubbleAssistant,
                {
                  backgroundColor: isCopied ? colors.bgSurfaceHover : colors.bgSurface,
                  borderColor: isCopied ? colors.accentSecondary : colors.borderDefault,
                },
              ],
        ]}
      >
        {item.imageUri && (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.attachedImage}
            resizeMode="cover"
          />
        )}
        {isUser ? (
          <Text style={[styles.bubbleText, { color: colors.textPrimary }]}>
            {item.text}
          </Text>
        ) : (
          <FormattedMessage
            text={item.text}
            textStyle={{ ...styles.bubbleText, color: colors.textPrimary }}
            colors={colors}
          />
        )}
        {!isUser && (
          <Text
            style={[
              styles.disclaimer,
              { color: isCopied ? colors.accentSecondary : colors.textMuted },
            ]}
          >
            {isCopied ? 'Copied to clipboard' : 'AI-generated. Not medical advice.'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Topic chips ──────────────────────────────────────────────────────────────

const TOPIC_CHIPS = [
  'Snake prevention tips',
  'First aid basics',
  'Snakes in my area',
  'What to do if bitten',
] as const;

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LearnScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const language = useSession((s) => s.language);
  const messages = useLearn((s) => s.messages);
  const thinking = useLearn((s) => s.thinking);
  const error = useLearn((s) => s.error);
  const addMessage = useLearn((s) => s.addMessage);
  const setThinking = useLearn((s) => s.setThinking);
  const setError = useLearn((s) => s.setError);
  const clearChat = useLearn((s) => s.clearChat);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { mode: inferenceMode, forced: inferenceForced, toggle: toggleInference } = useInferenceMode();

  // Dismiss keyboard when tapping the message list
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 60);
  }, []);

  const send = useCallback(
    async (text: string, imageUri?: string) => {
      const trimmed = text.trim();
      if ((!trimmed && !imageUri) || thinking) return;

      const userMsg: ChatMessage = {
        role: 'user',
        text: trimmed || 'What is in this photo?',
        ...(imageUri ? { imageUri } : {}),
      };
      addMessage(userMsg);
      setInput('');
      setPendingImage(null);
      setThinking(true);
      setError(null);
      scrollToBottom();

      try {
        const history = useLearn.getState().messages.slice(0, -1);
        const reply = await sendLearnMessage(history, userMsg.text, language, imageUri, inferenceForced);
        addMessage({ role: 'assistant', text: reply });
        scrollToBottom();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'no_api_key') {
          setError('API key missing. Check EXPO_PUBLIC_GOOGLE_AI_KEY in .env.');
        } else if (msg === 'cloud_required') {
          setError('Internet connection required. Connect to use Gemma 4 cloud mode.');
        } else if (msg === 'on_device_oom') {
          setError('Not enough memory to load the on-device model. Switch to Gemma 4 cloud mode.');
        } else if (msg === 'on_device_unavailable') {
          setError('On-device model unavailable. Download it from Settings → AI Model.');
        } else {
          setError(`Error: ${msg}`);
        }
      } finally {
        setThinking(false);
      }
    },
    [thinking, language, inferenceForced, addMessage, setThinking, setError, scrollToBottom],
  );

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingImage(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingImage(result.assets[0].uri);
    }
  }

  const handleCopy = useCallback(
    (index: number, text: string) => {
      void Clipboard.setStringAsync(text).then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1800);
      });
    },
    [],
  );

  const renderBubble = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => (
      <ChatBubble
        item={item}
        index={index}
        copiedIndex={copiedIndex}
        onCopy={handleCopy}
        colors={colors}
      />
    ),
    [copiedIndex, handleCopy, colors],
  );

  const canSend = (input.trim().length > 0 || pendingImage !== null) && !thinking;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        {/* Toolbar — only visible controls, no redundant title */}
        <View
          style={[
            styles.toolbar,
            {
              borderBottomColor: colors.borderDefault,
              backgroundColor: colors.bgPrimary,
            },
          ]}
        >
          <Pressable onPress={toggleInference} hitSlop={8}>
            {inferenceMode === 'cloud' ? (
              <View
                style={[
                  styles.modeBadge,
                  { backgroundColor: colors.bgSurface, borderColor: colors.accentPrimary },
                ]}
              >
                <MaterialCommunityIcons
                  name="cloud-outline"
                  size={13}
                  color={colors.accentSecondary}
                />
                <Text style={[styles.modeBadgeText, { color: colors.accentSecondary }]}>
                  Gemma 4
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.modeBadge,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: inferenceForced ? colors.warning : colors.borderDefault,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="cellphone"
                  size={13}
                  color={inferenceForced ? colors.warning : colors.textMuted}
                />
                <Text style={[styles.modeBadgeText, { color: inferenceForced ? colors.warning : colors.textMuted }]}>
                  On-device
                </Text>
              </View>
            )}
          </Pressable>

          {messages.length > 0 && (
            <Pressable
              onPress={clearChat}
              hitSlop={12}
              style={[
                styles.clearBtn,
                { borderColor: colors.borderDefault, backgroundColor: colors.bgSurface },
              ]}
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={16}
                color={colors.textMuted}
              />
              <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>
                Clear
              </Text>
            </Pressable>
          )}
        </View>

        {/* Empty state — topic chips */}
        {messages.length === 0 && !thinking && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={40}
              color={colors.borderDefault}
            />
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Ask a question or pick a topic
            </Text>
            <View style={styles.chips}>
              {TOPIC_CHIPS.map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderDefault,
                    },
                  ]}
                  onPress={() => { void send(chip); }}
                >
                  <Text style={[styles.chipText, { color: colors.accentSecondary }]}>
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[styles.messages, { paddingBottom: 8 }]}
          onScrollBeginDrag={dismissKeyboard}
          onContentSizeChange={() => scrollToBottom(false)}
          renderItem={renderBubble}
          ListFooterComponent={
            thinking ? (
              <View
                style={[
                  styles.bubble,
                  styles.bubbleAssistant,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderDefault,
                    alignSelf: 'flex-start',
                    marginHorizontal: 16,
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.accentSecondary} />
              </View>
            ) : error ? (
              <View
                style={[
                  styles.bubble,
                  styles.bubbleAssistant,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.danger,
                    alignSelf: 'flex-start',
                    marginHorizontal: 16,
                  },
                ]}
              >
                <Text style={[styles.bubbleText, { color: colors.danger }]}>
                  {error}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Pending image preview */}
        {pendingImage && (
          <View
            style={[
              styles.imagePreview,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
            ]}
          >
            <Image
              source={{ uri: pendingImage }}
              style={styles.imagePreviewThumb}
              resizeMode="cover"
            />
            <View style={styles.imagePreviewInfo}>
              <Text style={[styles.imagePreviewLabel, { color: colors.textPrimary }]}>
                Image attached
              </Text>
              <Text style={[styles.imagePreviewHint, { color: colors.textMuted }]}>
                Will be sent with your next message
              </Text>
            </View>
            <Pressable
              onPress={() => setPendingImage(null)}
              hitSlop={8}
              style={[styles.imagePreviewRemove, { backgroundColor: colors.bgSurfaceHover }]}
            >
              <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.bgSurface,
              borderTopColor: colors.borderDefault,
              paddingBottom: insets.bottom || 12,
            },
          ]}
        >
          {/* Image buttons */}
          <Pressable
            style={[styles.iconBtn, { borderColor: colors.borderDefault }]}
            onPress={() => { void pickImage(); }}
            disabled={thinking}
          >
            <MaterialCommunityIcons
              name="image-plus"
              size={20}
              color={thinking ? colors.textMuted : colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={[styles.iconBtn, { borderColor: colors.borderDefault }]}
            onPress={() => { void takePhoto(); }}
            disabled={thinking}
          >
            <MaterialCommunityIcons
              name="camera-plus-outline"
              size={20}
              color={thinking ? colors.textMuted : colors.textSecondary}
            />
          </Pressable>

          <TextInput
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.bgPrimary,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about snakes…"
            placeholderTextColor={colors.textMuted}
            returnKeyType="send"
            onSubmitEditing={() => { void send(input, pendingImage ?? undefined); }}
            blurOnSubmit={false}
            multiline
          />

          <Pressable
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend
                  ? colors.accentPrimary
                  : colors.bgSurfaceHover,
              },
            ]}
            onPress={() => { void send(input, pendingImage ?? undefined); }}
            disabled={!canSend}
          >
            <MaterialCommunityIcons
              name="send"
              size={20}
              color={canSend ? colors.textPrimary : colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  modeBadgeText: { fontSize: 11, fontWeight: '600' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 12 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyHint: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },

  // Messages
  messages: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  bubbleWrapper: { width: '100%' },
  bubbleWrapperUser: { alignItems: 'flex-end' },
  bubbleWrapperAssistant: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  disclaimer: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  attachedImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 8,
  },

  // Formatted message
  formattedBody: { gap: 4 },
  paragraphSpacing: { marginTop: 6 },
  bold: { fontWeight: '700' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingAccent: { width: 3, height: 18, borderRadius: 2 },
  headingTopMargin: { marginTop: 12 },
  h2: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2, flex: 1 },
  h3: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  numberedRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  numberedIndex: { fontWeight: '700', minWidth: 20 },
  numberedText: { flex: 1 },

  // Pending image preview card
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  imagePreviewThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  imagePreviewInfo: {
    flex: 1,
    gap: 4,
  },
  imagePreviewLabel: { fontSize: 14, fontWeight: '700' },
  imagePreviewHint: { fontSize: 11 },
  imagePreviewRemove: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
