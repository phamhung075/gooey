import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  User,
  Sparkles, 
  Activity,
  ChevronRight,
  CheckCircle,
  Zap,
  Maximize2,
  Minimize2,
  Terminal,
  MessageSquare,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { StreamMessage } from "./StreamMessage";
import type { ClaudeStreamMessage } from "./AgentExecution";
import { useAutoScroll } from "@/hooks";

interface SubAgentChatViewerProps {
  description?: string;
  prompt?: string;
  result?: any;
  subagent_type?: string;
  toolId?: string;
  parentSessionId?: string;
}

/**
 * Component to display sub-agent session as a separate chat interface
 */
export const SubAgentChatViewer: React.FC<SubAgentChatViewerProps> = ({ 
  description, 
  prompt, 
  result, 
  subagent_type,
  toolId,
  parentSessionId
}) => {
  const { isAutoScrollEnabled } = useAutoScroll();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [subAgentMessages, setSubAgentMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isSubAgentActive, setIsSubAgentActive] = useState(false);
  const [, setSubAgentInfo] = useState<any>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const processedEvents = useRef<Set<string>>(new Set());

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  };

  useEffect(() => {
    if (isAutoScrollEnabled) {
      scrollToBottom();
    }
  }, [subAgentMessages, isAutoScrollEnabled]);

  // Listen for sub-agent events with deduplication
  useEffect(() => {
    if (!parentSessionId || result || hasStarted) return;
    
    const setupListeners = async () => {
      // Listen for sub-agent start (only once)
      const startUnlisten = await listen<any>(`subagent-started:${parentSessionId}`, (event) => {
        const data = event.payload;
        const eventId = `start-${data.tool_id}`;
        
        if (data.tool_id === toolId && !processedEvents.current.has(eventId)) {
          processedEvents.current.add(eventId);
          console.log('[SubAgentChat] Sub-agent started:', data);
          
          setHasStarted(true);
          setIsSubAgentActive(true);
          setSubAgentInfo(data);
          
          // Add initial system message
          const systemMessage: ClaudeStreamMessage = {
            type: "system",
            subtype: "info",
            result: `Sub-agent started: ${data.description}`,
            timestamp: new Date().toISOString()
          };
          setSubAgentMessages([systemMessage]);
        }
      });
      unlistenRefs.current.push(startUnlisten);
      
      // Listen for sub-agent messages (deduplicated)
      const messageUnlisten = await listen<any>(`subagent-message:${parentSessionId}`, (event) => {
        const data = event.payload;
        const messageId = `msg-${data.sub_session_id}-${data.message?.timestamp || Date.now()}`;
        
        if (!processedEvents.current.has(messageId) && data.message) {
          processedEvents.current.add(messageId);
          console.log('[SubAgentChat] Sub-agent message:', data);
          
          // Convert the message to ClaudeStreamMessage format
          const message: ClaudeStreamMessage = {
            type: data.message.type || "assistant",
            subtype: data.type === "subagent_thinking" ? "thinking" : undefined,
            message: data.message.message,
            timestamp: data.message.timestamp || new Date().toISOString()
          };
          
          setSubAgentMessages(prev => {
            // Avoid duplicate messages
            const isDuplicate = prev.some(m => 
              m.timestamp === message.timestamp && 
              JSON.stringify(m.message) === JSON.stringify(message.message)
            );
            
            return isDuplicate ? prev : [...prev, message];
          });
        }
      });
      unlistenRefs.current.push(messageUnlisten);
      
      // Listen for sub-agent completion (only once)
      const completeUnlisten = await listen<any>(`subagent-complete:${parentSessionId}`, (event) => {
        const data = event.payload;
        const eventId = `complete-${data.tool_id}`;
        
        if (data.tool_id === toolId && !processedEvents.current.has(eventId)) {
          processedEvents.current.add(eventId);
          console.log('[SubAgentChat] Sub-agent completed:', data);
          
          setIsSubAgentActive(false);
          
          // Add completion message
          const completionMessage: ClaudeStreamMessage = {
            type: "system",
            subtype: "success",
            result: "Sub-agent task completed",
            timestamp: new Date().toISOString()
          };
          setSubAgentMessages(prev => [...prev, completionMessage]);
        }
      });
      unlistenRefs.current.push(completeUnlisten);
    };
    
    setupListeners();
    
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, [parentSessionId, toolId, result, hasStarted]);

  // Parse final result
  const parseResult = () => {
    if (!result) return null;
    
    if (typeof result === 'string') {
      return result;
    } else if (result?.content) {
      if (typeof result.content === 'object' && result.content.text) {
        return result.content.text;
      } else if (typeof result.content === 'string') {
        return result.content;
      }
      return JSON.stringify(result.content, null, 2);
    } else if (result?.output) {
      return result.output;
    } else if (result?.text) {
      return result.text;
    }
    return JSON.stringify(result, null, 2);
  };

  const finalResult = parseResult();
  const hasResult = !!finalResult;
  const hasMessages = subAgentMessages.length > 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="h-4 w-4 text-purple-500" />
            <Sparkles className={cn(
              "h-2.5 w-2.5 text-purple-400 absolute -top-1 -right-1",
              isSubAgentActive && "animate-pulse"
            )} />
          </div>
          <span className="text-sm font-medium">
            Sub-Agent Session
          </span>
          {subagent_type && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {subagent_type}
            </span>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>{subAgentMessages.length} messages</span>
          </div>
        </div>
        <button
          onClick={() => setShowFullView(!showFullView)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title={showFullView ? "Minimize view" : "Expand view"}
        >
          {showFullView ? (
            <Minimize2 className="h-3.5 w-3.5 text-gray-500" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-gray-500" />
          )}
        </button>
      </div>

      <div className="ml-6 space-y-3">
        {/* Task Description */}
        {description && (
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Task</span>
            </div>
            <p className="text-sm text-foreground ml-5">{description}</p>
          </div>
        )}

        {/* Instructions (collapsible) */}
        {prompt && (
          <div className="space-y-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
              <span>Task Instructions</span>
            </button>
            
            {isExpanded && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {prompt}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Sub-Agent Chat Interface */}
        {hasMessages && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Terminal className="h-3 w-3" />
              <span>Sub-Agent Chat</span>
              {isSubAgentActive && (
                <span className="flex items-center gap-1 text-orange-500">
                  <Activity className="h-3 w-3 animate-pulse" />
                  <span>Active</span>
                </span>
              )}
            </div>
            
            <div className={cn(
              "rounded-lg border border-purple-500/20 bg-gray-950/50 overflow-hidden transition-all",
              showFullView ? "max-h-[500px]" : "max-h-[300px]"
            )}>
              <div ref={chatContainerRef} className="overflow-y-auto h-full">
                {/* Chat Messages */}
                <div className="p-3 space-y-2">
                  {subAgentMessages.map((message, idx) => (
                    <div key={idx} className="text-xs">
                      {/* System messages */}
                      {message.type === "system" && (
                        <div className="flex items-center gap-2 p-2 rounded bg-gray-800/50">
                          {message.subtype === "success" ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <Bot className="h-3 w-3 text-blue-500" />
                          )}
                          <span className="text-gray-300">{message.result}</span>
                        </div>
                      )}
                      
                      {/* Assistant messages */}
                      {message.type === "assistant" && (
                        <div className="flex items-start gap-2 p-2 rounded bg-purple-500/10">
                          <Bot className="h-3 w-3 text-purple-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            {message.subtype === "thinking" && (
                              <div className="text-purple-400 italic text-xs mb-1">Thinking...</div>
                            )}
                            <StreamMessage
                              message={message}
                              streamMessages={subAgentMessages}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* User messages */}
                      {message.type === "user" && (
                        <div className="flex items-start gap-2 p-2 rounded bg-blue-500/10">
                          <User className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <StreamMessage
                              message={message}
                              streamMessages={subAgentMessages}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Loading indicator */}
                  {isSubAgentActive && (
                    <div className="flex items-center gap-2 p-2 rounded bg-gray-800/50">
                      <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                      <span className="text-gray-400 text-xs">Sub-agent is working...</span>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No messages yet */}
        {!hasMessages && !hasResult && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Waiting for sub-agent to start...</span>
          </div>
        )}

        {/* Final Result */}
        {hasResult && (
          <div className="space-y-2">
            <button
              onClick={() => setShowResult(!showResult)}
              className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Final Result</span>
              <ChevronRight className={cn("h-3 w-3 transition-transform ml-auto", showResult && "rotate-90")} />
            </button>
            
            {showResult && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                  {typeof finalResult === 'string' ? finalResult : JSON.stringify(finalResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};