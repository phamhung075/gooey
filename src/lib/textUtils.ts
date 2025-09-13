/**
 * Utility functions for text processing and formatting
 */

/**
 * Converts pipe characters (|) to newlines (\n) for proper markdown display
 * @param text - Text containing pipe characters as line separators
 * @returns Text with pipes converted to newlines
 *
 * @example
 * // Input: "Line 1|Line 2|Line 3"
 * // Output: "Line 1\nLine 2\nLine 3"
 */
export const convertPipesToNewlines = (text: string): string => {
  if (!text) return '';

  // Replace all pipe characters with newlines
  return text.replace(/\|/g, '\n');
};

/**
 * Processes text for markdown display by converting pipe separators
 * and ensuring proper line breaks
 * @param text - Raw text content
 * @returns Processed text ready for markdown rendering
 */
export const preprocessTextForMarkdown = (text: string): string => {
  if (!text) return '';

  let processedText = text;

  // Convert pipe characters to newlines
  processedText = convertPipesToNewlines(processedText);

  // Ensure double newlines for proper markdown paragraph breaks
  processedText = processedText.replace(/\n\n\n+/g, '\n\n'); // Reduce multiple newlines to double

  return processedText.trim();
};