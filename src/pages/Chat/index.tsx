/**
 * Chat Page
 * Native React implementation communicating with OpenClaw Gateway
 * via gateway:rpc IPC. Session selector, thinking toggle, and refresh
 * are in the toolbar; messages render with markdown + streaming.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AlertCircle, FileText, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatToolbar } from './ChatToolbar';
import { extractImages, extractText, extractThinking, extractToolUse } from './message-utils';
import { useTranslation } from 'react-i18next';
import logoSvg from '@/assets/logo.svg';

export function Chat() {
  const { t, i18n } = useTranslation('chat');
  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';
  const currentLang = i18n.language;

  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const showThinking = useChatStore((s) => s.showThinking);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingTimestamp, setStreamingTimestamp] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  // Get guide examples from i18n
  const guideExamples = useMemo(() => {
    const lang = currentLang?.split('-')[0] || 'zh';
    const bundle = i18n.getResourceBundle(lang, 'chat');
    return {
      fileOrganize: bundle?.welcome?.guide?.fileOrganize?.examples || [],
      documentProcessing: bundle?.welcome?.guide?.documentProcessing?.examples || [],
      scheduledTasks: bundle?.welcome?.guide?.scheduledTasks?.examples || [],
    };
  }, [i18n, currentLang]);

  // Handle category selection from welcome screen
  const handleCategorySelect = useCallback((categoryKey: string) => {
    setSelectedCategory(categoryKey);
  }, []);

  // Handle example click - fill input but don't send
  const handleExampleClick = useCallback((text: string) => {
    setInputValue(text);
    setSelectedCategory(null);
  }, []);

  // Close examples when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCategory(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Load data when gateway is running.
  // When the store already holds messages for this session (i.e. the user
  // is navigating *back* to Chat), use quiet mode so the existing messages
  // stay visible while fresh data loads in the background.  This avoids
  // an unnecessary messages → spinner → messages flicker.
  useEffect(() => {
    if (!isGatewayRunning) return;
    let cancelled = false;
    const hasExistingMessages = useChatStore.getState().messages.length > 0;
    (async () => {
      await loadSessions();
      if (cancelled) return;
      await loadHistory(hasExistingMessages);
    })();
    return () => {
      cancelled = true;
    };
  }, [isGatewayRunning, loadHistory, loadSessions]);

  // Auto-scroll on new messages, streaming, or activity changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage, sending, pendingFinal]);

  // Update timestamp when sending starts
  useEffect(() => {
    if (sending && streamingTimestamp === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamingTimestamp(Date.now() / 1000);
    } else if (!sending && streamingTimestamp !== 0) {
      setStreamingTimestamp(0);
    }
  }, [sending, streamingTimestamp]);

  // Gateway not running
  if (!isGatewayRunning) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center p-8">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('gatewayNotRunning')}</h2>
        <p className="text-muted-foreground max-w-md">
          {t('gatewayRequired')}
        </p>
      </div>
    );
  }

  const streamMsg = streamingMessage && typeof streamingMessage === 'object'
    ? streamingMessage as unknown as { role?: string; content?: unknown; timestamp?: number }
    : null;
  const streamText = streamMsg ? extractText(streamMsg) : (typeof streamingMessage === 'string' ? streamingMessage : '');
  const hasStreamText = streamText.trim().length > 0;
  const streamThinking = streamMsg ? extractThinking(streamMsg) : null;
  const hasStreamThinking = showThinking && !!streamThinking && streamThinking.trim().length > 0;
  const streamTools = streamMsg ? extractToolUse(streamMsg) : [];
  const hasStreamTools = streamTools.length > 0;
  const streamImages = streamMsg ? extractImages(streamMsg) : [];
  const hasStreamImages = streamImages.length > 0;
  const hasStreamToolStatus = streamingTools.length > 0;
  const shouldRenderStreaming = sending && (hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus);
  const hasAnyStreamContent = hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus;

  // Get examples for selected category
  const currentExamples = selectedCategory ? guideExamples[selectedCategory as keyof typeof guideExamples] : [];

  return (
    <div className="flex flex-col -m-6" style={{ height: 'calc(100vh - 2.5rem)' }}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-end px-4 py-2">
        <ChatToolbar />
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {loading && !sending ? (
            <div className="flex h-full items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : messages.length === 0 && !sending ? (
            <WelcomeScreen onCategorySelect={handleCategorySelect} />
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id || `msg-${idx}`}
                  message={msg}
                  showThinking={showThinking}
                />
              ))}

              {/* Streaming message */}
              {shouldRenderStreaming && (
                <ChatMessage
                  message={(streamMsg
                    ? {
                        ...(streamMsg as Record<string, unknown>),
                        role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
                        content: streamMsg.content ?? streamText,
                        timestamp: streamMsg.timestamp ?? streamingTimestamp,
                      }
                    : {
                        role: 'assistant',
                        content: streamText,
                        timestamp: streamingTimestamp,
                      }) as RawMessage}
                  showThinking={showThinking}
                  isStreaming
                  streamingTools={streamingTools}
                />
              )}

              {/* Activity indicator: waiting for next AI turn after tool execution */}
              {sending && pendingFinal && !shouldRenderStreaming && (
                <ActivityIndicator phase="tool_processing" />
              )}

              {/* Typing indicator when sending but no stream content yet */}
              {sending && !pendingFinal && !hasAnyStreamContent && (
                <TypingIndicator />
              )}
            </>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
            <button
              onClick={clearError}
              className="text-xs text-destructive/60 hover:text-destructive underline"
            >
              {t('common:actions.dismiss')}
            </button>
          </div>
        </div>
      )}

      {/* Examples Popover - shown when category is selected */}
      {selectedCategory && currentExamples.length > 0 && (
        <ExamplesPopover
          examples={currentExamples}
          onExampleClick={handleExampleClick}
          onClose={() => setSelectedCategory(null)}
        />
      )}

      {/* Input Area */}
      <ChatInput
        onSend={sendMessage}
        onStop={abortRun}
        disabled={!isGatewayRunning}
        sending={sending}
        inputText={inputValue}
        onInputChange={setInputValue}
      />
    </div>
  );
}

// ── Examples Popover ────────────────────────────────────────────

function ExamplesPopover({
  examples,
  onExampleClick,
  onClose,
}: {
  examples: string[];
  onExampleClick: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="px-4 py-2 bg-muted/30 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-end mb-2">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="space-y-1.5">
          {examples.map((example: string, idx: number) => (
            <button
              key={idx}
              onClick={() => onExampleClick(example)}
              className="text-left w-full p-2 rounded-md bg-background hover:bg-muted/80 border border-border hover:border-primary/40 transition-all text-xs text-muted-foreground hover:text-foreground flex items-center gap-2 group"
            >
              <span className="shrink-0">
                <svg className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949A3.286 3.286 0 016 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </span>
              <span className="flex-1 truncate">{example}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen ──────────────────────────────────────────────

function WelcomeScreen({ onCategorySelect }: { onCategorySelect?: (key: string) => void }) {
  const { t } = useTranslation('chat');

  const guideCategories = [
    { key: 'fileOrganize', icon: MessageSquare, titleKey: 'welcome.guide.fileOrganize.title' },
    { key: 'documentProcessing', icon: FileText, titleKey: 'welcome.guide.documentProcessing.title' },
    { key: 'scheduledTasks', icon: Sparkles, titleKey: 'welcome.guide.scheduledTasks.title' },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mb-6">
        <img src={logoSvg} alt="Logo" className="h-16 w-16" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{t('welcome.title')}</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        {t('welcome.subtitle')}
      </p>

      {/* Guide Categories */}
      <div className="w-full max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {guideCategories.map((category) => (
            <Card
              key={category.key}
              className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
              onClick={() => onCategorySelect?.(category.key)}
            >
              <CardContent className="p-6 text-center">
                <category.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <h4 className="font-medium">{t(category.titleKey)}</h4>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="bg-muted rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Activity Indicator (shown between tool cycles) ─────────────

function ActivityIndicator({ phase }: { phase: 'tool_processing' }) {
  void phase;
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="bg-muted rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Processing tool results…</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
