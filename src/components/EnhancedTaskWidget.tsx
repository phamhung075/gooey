import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Sparkles, 
  Loader2,
  Activity,
  ChevronRight,
  CheckCircle,
  Zap,
  Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface EnhancedTaskWidgetProps {
  description?: string;
  prompt?: string;
  result?: any;
  subagent_type?: string;
  toolId?: string;
  parentSessionId?: string; // Parent Claude session ID
}

/**
 * Enhanced Task widget that explains the limitation and shows available info
 */
export const EnhancedTaskWidget: React.FC<EnhancedTaskWidgetProps> = ({ 
  description, 
  prompt, 
  result, 
  subagent_type,
  toolId,
  parentSessionId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [subAgentOutput, setSubAgentOutput] = useState<any[]>([]);
  const [subAgentStatus, setSubAgentStatus] = useState<string>('');
  const [isSubAgentActive, setIsSubAgentActive] = useState(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

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

  // Listen for sub-agent events from backend
  useEffect(() => {
    if (!parentSessionId || result) return;
    
    const setupListeners = async () => {
      // Listen for sub-agent start
      const startUnlisten = await listen<any>(`subagent-started:${parentSessionId}`, (event) => {
        const data = event.payload;
        if (data.tool_id === toolId) {
          console.log('Sub-agent started:', data);
          setIsSubAgentActive(true);
          setSubAgentStatus('Sub-agent process started');
        }
      });
      unlistenRefs.current.push(startUnlisten);
      
      // Listen for sub-agent output
      const outputUnlisten = await listen<any>(`subagent-output:${parentSessionId}`, (event) => {
        const data = event.payload;
        if (data.subagent_id?.includes(toolId)) {
          console.log('Sub-agent output:', data);
          setSubAgentOutput(prev => [...prev, data]);
          if (data.type === 'status') {
            setSubAgentStatus(data.message);
          }
        }
      });
      unlistenRefs.current.push(outputUnlisten);
      
      // Listen for sub-agent completion
      const completeUnlisten = await listen<any>(`subagent-complete:${parentSessionId}`, (event) => {
        const data = event.payload;
        if (data.tool_id === toolId) {
          console.log('Sub-agent completed:', data);
          setIsSubAgentActive(false);
          setSubAgentStatus('Sub-agent completed');
        }
      });
      unlistenRefs.current.push(completeUnlisten);
    };
    
    setupListeners();
    
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, [parentSessionId, toolId, result]);

  // Stop listening when result arrives
  useEffect(() => {
    if (result) {
      setIsSubAgentActive(false);
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    }
  }, [result]);

  const finalResult = parseResult();
  const hasResult = !!finalResult;
  const isActive = !hasResult || isSubAgentActive;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <Bot className="h-4 w-4 text-purple-500" />
          <Sparkles className={cn(
            "h-2.5 w-2.5 text-purple-400 absolute -top-1 -right-1",
            isActive && "animate-pulse"
          )} />
        </div>
        <span className="text-sm font-medium">
          {hasResult ? "Sub-Agent Task Completed" : "Sub-Agent Task Running"}
        </span>
        {subagent_type && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
            {subagent_type}
          </span>
        )}
      </div>

      <div className="ml-6 space-y-3">
        {/* Task Description */}
        {description && (
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Task Description</span>
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

        {/* Sub-Agent Status and Output */}
        {isActive && (
          <div className="space-y-2">
            {/* Status Box */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
              <div className="flex items-start gap-2">
                <Activity className="h-3.5 w-3.5 text-purple-500 mt-0.5 animate-pulse" />
                <div className="space-y-1 flex-1">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    Sub-Agent Active
                  </p>
                  {subAgentStatus && (
                    <p className="text-xs text-muted-foreground">
                      {subAgentStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Sub-Agent Output Stream */}
            {subAgentOutput.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3 w-3" />
                  <span>Sub-Agent Activity</span>
                </div>
                <div className="rounded-lg border border-purple-500/10 bg-black/50 p-2 max-h-48 overflow-y-auto">
                  {subAgentOutput.slice(-10).map((item, idx) => (
                    <div key={idx} className="text-xs font-mono py-0.5">
                      {item.type === 'status' ? (
                        <div className="text-orange-400">
                          <span className="opacity-50">⚡</span> {item.message}
                        </div>
                      ) : item.type === 'output' ? (
                        <div className="text-gray-300">
                          {item.content}
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          {JSON.stringify(item).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Fallback info if no output yet */}
            {subAgentOutput.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Waiting for sub-agent output...</span>
              </div>
            )}
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
              <span>Sub-Agent Result</span>
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