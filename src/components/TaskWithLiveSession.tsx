import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Bot, 
  Sparkles, 
  Loader2,
  Activity,
  ChevronRight,
  CheckCircle,
  Zap,
  Maximize2,
  Minimize2,
  Terminal,
  Package,
  AlertCircle,
  Code,
  FileEdit,
  Search,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ClaudeStreamMessage } from "./AgentExecution";

interface TaskWithLiveSessionProps {
  description?: string;
  prompt?: string;
  result?: any;
  subagent_type?: string;
  toolId?: string; // The tool_use ID to help track this task
}

/**
 * Enhanced Task widget that shows live sub-agent session content
 * Attempts to capture and display real-time sub-agent activities
 */
export const TaskWithLiveSession: React.FC<TaskWithLiveSessionProps> = ({ 
  description, 
  prompt, 
  result, 
  subagent_type,
  toolId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [isSubAgentActive, setIsSubAgentActive] = useState(!result);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const isMountedRef = useRef(true);
  const capturedMessagesRef = useRef<Set<string>>(new Set());

  // Set up event listeners to capture sub-agent activity
  useEffect(() => {
    if (!isSubAgentActive) return;

    const setupListeners = async () => {
      console.log(`[TaskWithLiveSession] Setting up listeners for task: ${description}`);

      try {
        // Listen to all claude output to detect sub-agent messages
        const outputUnlisten = await listen<string>('claude-output', (event) => {
          if (!isMountedRef.current) return;
          
          try {
            const payload = event.payload;
            
            // Try to detect if this is from a sub-agent by looking for patterns
            const isSubAgentMessage = 
              payload.includes('Task') ||
              payload.includes('sub_agent') ||
              payload.includes('delegate') ||
              (description && payload.includes(description.substring(0, 20))) ||
              (subagent_type && payload.includes(subagent_type));
            
            if (isSubAgentMessage) {
              // Create a unique key for deduplication
              const messageKey = payload.substring(0, 100);
              if (!capturedMessagesRef.current.has(messageKey)) {
                capturedMessagesRef.current.add(messageKey);
                
                // Try to parse as structured message
                let messageContent: any;
                try {
                  messageContent = JSON.parse(payload);
                } catch {
                  // If not JSON, treat as text
                  messageContent = { type: 'text', content: payload };
                }
                
                console.log('[TaskWithLiveSession] Captured sub-agent message:', messageContent);
                setLiveMessages(prev => [...prev, messageContent]);
              }
            }
          } catch (err) {
            console.error('[TaskWithLiveSession] Error processing message:', err);
          }
        });
        unlistenRefs.current.push(outputUnlisten);

      } catch (err) {
        console.error('[TaskWithLiveSession] Failed to set up listeners:', err);
      }
    };

    setupListeners();

    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      capturedMessagesRef.current.clear();
    };
  }, [isSubAgentActive, description, subagent_type]);

  // Mark as unmounted on cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stop listening when result arrives
  useEffect(() => {
    if (result) {
      setIsSubAgentActive(false);
    }
  }, [result]);

  // Parse and format messages
  const formattedMessages = useMemo(() => {
    return liveMessages.map(msg => {
      if (typeof msg === 'string') {
        return { type: 'text', content: msg };
      }
      if (msg.message?.content) {
        // Extract tool uses and text from message content
        const contents = Array.isArray(msg.message.content) ? msg.message.content : [msg.message.content];
        return contents.map((c: any) => {
          if (c.type === 'tool_use') {
            return { 
              type: 'tool', 
              content: `Using ${c.name} tool${c.input ? ': ' + JSON.stringify(c.input).substring(0, 100) + '...' : ''}` 
            };
          }
          if (c.type === 'text') {
            return { type: 'text', content: c.text };
          }
          return { type: 'unknown', content: JSON.stringify(c) };
        });
      }
      return { type: 'raw', content: JSON.stringify(msg, null, 2) };
    }).flat();
  }, [liveMessages]);

  // Parse final result
  const parseResult = () => {
    if (!result) return null;
    
    if (typeof result === 'string') {
      return result;
    } else if (result?.content) {
      if (typeof result.content === 'object' && result.content.text) {
        return result.content.text;
      }
      return result.content;
    } else if (result?.output) {
      return result.output;
    }
    return JSON.stringify(result, null, 2);
  };

  const finalResult = parseResult();
  const hasLiveContent = formattedMessages.length > 0;
  const hasResult = !!finalResult;

  // Icon for message types
  const getMessageIcon = (type: string) => {
    switch(type) {
      case 'tool': return <Wrench className="h-3 w-3 text-blue-500" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'text': return <Bot className="h-3 w-3 text-purple-500" />;
      default: return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

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
            {hasResult ? "Sub-Agent Task Completed" : "Sub-Agent Working"}
          </span>
          {subagent_type && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {subagent_type}
            </span>
          )}
        </div>
        {hasLiveContent && (
          <button
            onClick={() => setShowFullView(!showFullView)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title={showFullView ? "Minimize" : "Expand"}
          >
            {showFullView ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
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

        {/* Live Activity Feed */}
        {hasLiveContent && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3 w-3 text-orange-500 animate-pulse" />
              <span>Sub-Agent Activity</span>
              <span className="text-[10px] opacity-50">({formattedMessages.length} actions)</span>
            </div>
            
            <div className={cn(
              "rounded-lg border border-purple-500/20 bg-black/50 overflow-hidden transition-all",
              showFullView ? "max-h-[400px]" : "max-h-[150px]"
            )}>
              <div className="overflow-y-auto h-full p-2 space-y-1">
                {formattedMessages.slice(showFullView ? 0 : -5).map((msg, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-0.5">
                    <div className="mt-0.5">{getMessageIcon(msg.type)}</div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words flex-1">
                      {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {!hasLiveContent && isSubAgentActive && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Sub-agent initializing...</span>
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