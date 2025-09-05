import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Sparkles, 
  Loader2,
  Activity,
  ChevronRight,
  CheckCircle,
  Maximize2,
  Minimize2,
  Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { StreamMessage } from "./StreamMessage";
import type { ClaudeStreamMessage } from "./AgentExecution";

interface SubAgentSessionProps {
  description?: string;
  prompt?: string;
  result?: any;
  subagent_type?: string;
  session_id?: string; // Sub-agent session ID if available
}

/**
 * Component to display live sub-agent session content
 * Shows real-time streaming of sub-agent activities like a mini Claude session viewer
 */
export const SubAgentSession: React.FC<SubAgentSessionProps> = ({ 
  description, 
  prompt, 
  result, 
  subagent_type,
  session_id
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isSubAgentActive, setIsSubAgentActive] = useState(!result);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const isMountedRef = useRef(true);

  // Extract session ID from result if available
  const extractSessionId = () => {
    if (session_id) return session_id;
    if (result?.session_id) return result.session_id;
    if (result?.metadata?.session_id) return result.metadata.session_id;
    // Try to extract from the result content if it mentions a session
    if (typeof result === 'string' && result.includes('session_id:')) {
      const match = result.match(/session_id:\s*([a-zA-Z0-9-]+)/);
      if (match) return match[1];
    }
    return null;
  };

  const subAgentSessionId = extractSessionId();

  // Set up event listeners for sub-agent session
  useEffect(() => {
    if (!subAgentSessionId || !isSubAgentActive) return;

    const setupListeners = async () => {
      console.log(`[SubAgentSession] Setting up listeners for sub-agent session: ${subAgentSessionId}`);

      try {
        // Listen to sub-agent's output stream
        const outputUnlisten = await listen<string>(`claude-output:${subAgentSessionId}`, (event) => {
          if (!isMountedRef.current) return;
          
          try {
            const message = JSON.parse(event.payload) as ClaudeStreamMessage;
            console.log('[SubAgentSession] Received sub-agent message:', message);
            
            setLiveMessages(prev => [...prev, message]);
          } catch (err) {
            console.error('[SubAgentSession] Failed to parse sub-agent message:', err);
          }
        });
        unlistenRefs.current.push(outputUnlisten);

        // Listen for sub-agent completion
        const completeUnlisten = await listen<boolean>(`claude-complete:${subAgentSessionId}`, (event) => {
          if (!isMountedRef.current) return;
          console.log('[SubAgentSession] Sub-agent session completed');
          setIsSubAgentActive(false);
        });
        unlistenRefs.current.push(completeUnlisten);

        // Listen for sub-agent errors
        const errorUnlisten = await listen<string>(`claude-error:${subAgentSessionId}`, (event) => {
          if (!isMountedRef.current) return;
          console.error('[SubAgentSession] Sub-agent error:', event.payload);
          
          const errorMessage: ClaudeStreamMessage = {
            type: "system",
            subtype: "error",
            result: event.payload,
            timestamp: new Date().toISOString()
          };
          setLiveMessages(prev => [...prev, errorMessage]);
        });
        unlistenRefs.current.push(errorUnlisten);

        // Also try generic listeners in case session ID isn't properly routed
        const genericOutputUnlisten = await listen<string>('claude-output', (event) => {
          if (!isMountedRef.current) return;
          
          try {
            const payload = event.payload;
            // Check if this message is from our sub-agent
            if (payload.includes(subAgentSessionId) || payload.includes('Task')) {
              const message = JSON.parse(payload) as ClaudeStreamMessage;
              // Only add if not duplicate
              setLiveMessages(prev => {
                const isDuplicate = prev.some(m => 
                  JSON.stringify(m) === JSON.stringify(message)
                );
                return isDuplicate ? prev : [...prev, message];
              });
            }
          } catch (err) {
            // Silent fail for non-matching messages
          }
        });
        unlistenRefs.current.push(genericOutputUnlisten);

      } catch (err) {
        console.error('[SubAgentSession] Failed to set up listeners:', err);
      }
    };

    setupListeners();

    return () => {
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, [subAgentSessionId, isSubAgentActive]);

  // Mark as unmounted on cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Parse final result when available
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
  const hasLiveContent = liveMessages.length > 0;
  const hasResult = !!finalResult;

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
            {hasResult ? "Sub-Agent Task Completed" : "Sub-Agent Session"}
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
            title={showFullView ? "Minimize view" : "Expand view"}
          >
            {showFullView ? (
              <Minimize2 className="h-3.5 w-3.5 text-gray-500" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-gray-500" />
            )}
          </button>
        )}
      </div>

      <div className="ml-6 space-y-3">
        {/* Task Description */}
        {description && (
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Terminal className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Task</span>
            </div>
            <p className="text-sm text-foreground ml-5">{description}</p>
          </div>
        )}

        {/* Task Instructions (collapsible) */}
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

        {/* Live Session View */}
        {hasLiveContent && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3 w-3 text-orange-500 animate-pulse" />
              <span>Live Sub-Agent Session</span>
              {subAgentSessionId && (
                <span className="font-mono text-[10px] opacity-50">({subAgentSessionId.slice(0, 8)}...)</span>
              )}
            </div>
            
            <div className={cn(
              "rounded-lg border border-purple-500/20 bg-black/50 overflow-hidden transition-all",
              showFullView ? "max-h-[600px]" : "max-h-[200px]"
            )}>
              <div className="overflow-y-auto h-full p-2 space-y-1">
                {liveMessages.map((message, idx) => (
                  <div key={idx} className="text-xs">
                    <StreamMessage 
                      message={message} 
                      streamMessages={liveMessages}
                      className="text-xs"
                    />
                  </div>
                ))}
                {isSubAgentActive && (
                  <div className="flex items-center gap-2 text-xs text-orange-400 mt-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Sub-agent is working...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No live content but active */}
        {!hasLiveContent && isSubAgentActive && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Waiting for sub-agent session to start...</span>
            {subAgentSessionId && (
              <span className="font-mono text-[10px] opacity-50">({subAgentSessionId})</span>
            )}
          </div>
        )}

        {/* Final Result */}
        {hasResult && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Final Result</span>
            </div>
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
              {finalResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};