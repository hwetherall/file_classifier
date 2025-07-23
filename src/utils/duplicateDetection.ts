import { DocumentFile } from '../types/document';

export function findDuplicateFiles(files: DocumentFile[]): DocumentFile[][] {
  const duplicates: DocumentFile[][] = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < files.length; i++) {
    if (processed.has(files[i].id)) continue;
    
    const duplicateGroup: DocumentFile[] = [files[i]];
    processed.add(files[i].id);
    
    for (let j = i + 1; j < files.length; j++) {
      if (isDuplicate(files[i], files[j])) {
        duplicateGroup.push(files[j]);
        processed.add(files[j].id);
      }
    }
    
    if (duplicateGroup.length > 1) {
      duplicates.push(duplicateGroup);
    }
  }
  
  return duplicates;
}

export function isDuplicate(file1: DocumentFile, file2: DocumentFile): boolean {
  // Check if files have the same name and size
  if (file1.name === file2.name && file1.size === file2.size) {
    return true;
  }
  
  // Check if files have the same content (if available)
  if (file1.content && file2.content && file1.content === file2.content) {
    return true;
  }
  
  return false;
}

export function removeDuplicates(files: DocumentFile[]): DocumentFile[] {
  const uniqueFiles: DocumentFile[] = [];
  const seen = new Set<string>();
  
  for (const file of files) {
    const key = `${file.name}-${file.size}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFiles.push(file);
    }
  }
  
  return uniqueFiles;
} 