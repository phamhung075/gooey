/**
 * Utility functions for working with file paths
 */

/**
 * Extracts the filename from a full file path
 * @param filePath - The full path to extract filename from
 * @returns The filename portion of the path
 */
export const getFileName = (filePath: string): string => {
  if (!filePath) return '';

  // Handle both forward slashes and backslashes
  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1];

  return fileName || filePath;
};

/**
 * Extracts the parent directory and filename for display
 * @param filePath - The full path
 * @returns The parent folder + filename (e.g., "components/Button.tsx")
 */
export const getParentAndFileName = (filePath: string): string => {
  if (!filePath) return '';

  // Handle both forward slashes and backslashes
  const parts = filePath.split(/[/\\]/);

  if (parts.length <= 1) {
    return filePath; // No parent directory
  }

  if (parts.length === 2) {
    return filePath; // Just parent + file
  }

  // Return parent directory + filename
  const fileName = parts[parts.length - 1];
  const parentDir = parts[parts.length - 2];

  return `${parentDir}/${fileName}`;
};

/**
 * Gets the directory path without the filename
 * @param filePath - The full path
 * @returns The directory path
 */
export const getDirectoryPath = (filePath: string): string => {
  if (!filePath) return '';

  // Handle both forward slashes and backslashes
  const parts = filePath.split(/[/\\]/);
  parts.pop(); // Remove filename

  return parts.join('/');
};

/**
 * Checks if a path is absolute
 * @param filePath - The path to check
 * @returns True if absolute path
 */
export const isAbsolutePath = (filePath: string): boolean => {
  if (!filePath) return false;

  // Check for Unix absolute path (starts with /)
  if (filePath.startsWith('/')) return true;

  // Check for Windows absolute path (starts with drive letter)
  if (filePath.match(/^[a-zA-Z]:/)) return true;

  return false;
};