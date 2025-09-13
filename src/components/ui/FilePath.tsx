import React, { useState } from 'react';
import { Copy, Check, File } from 'lucide-react';
import { Button } from './button';
import { TooltipProvider, TooltipSimple } from './tooltip-modern';
import { getFileName, getParentAndFileName } from '@/lib/pathUtils';
import { cn } from '@/lib/utils';

interface FilePathProps {
  /**
   * Full file path
   */
  path: string;
  /**
   * Whether to show the full path or just filename
   */
  showFullPath?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Component to display file paths with copy functionality
 * Shows only the filename by default, but allows copying the full path
 */
export const FilePath: React.FC<FilePathProps> = ({
  path,
  showFullPath = false,
  className,
  size = 'md'
}) => {
  const [copied, setCopied] = useState(false);

  const displayText = showFullPath ? path : getParentAndFileName(path);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2 py-1'
  };

  const buttonSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7'
  };

  const iconSizeClasses = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5'
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  return (
    <TooltipProvider>
      <div className={cn(
        'inline-flex items-center gap-1 bg-background border rounded-md font-mono',
        sizeClasses[size],
        className
      )}>
        <File className={cn('text-muted-foreground flex-shrink-0', iconSizeClasses[size])} />

        <TooltipSimple content={path} side="bottom">
          <span className="truncate max-w-[300px] min-w-[120px]">
            {displayText}
          </span>
        </TooltipSimple>

        <TooltipSimple
          content={copied ? 'Copied!' : 'Copy full path'}
          side="bottom"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className={cn(
              'flex-shrink-0 hover:bg-accent',
              buttonSizeClasses[size]
            )}
          >
            {copied ? (
              <Check className={cn('text-green-500', iconSizeClasses[size])} />
            ) : (
              <Copy className={cn('text-muted-foreground hover:text-foreground', iconSizeClasses[size])} />
            )}
          </Button>
        </TooltipSimple>
      </div>
    </TooltipProvider>
  );
};