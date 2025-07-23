import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentFile } from '../../types/document';
import { validateFileType, validateFileSize } from '../../utils/fileValidation';

interface FileUploadZoneProps {
  onFilesAdded: (files: DocumentFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export default function FileUploadZone({ 
  onFilesAdded, 
  maxFiles = 50, 
  maxSizeMB = 100 
}: FileUploadZoneProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('onDrop called with', acceptedFiles.length, 'files');
    setIsProcessing(true);

    try {
      const validFiles: DocumentFile[] = [];
      const errors: string[] = [];

      for (const file of acceptedFiles) {
        // Validate file type
        if (!validateFileType(file)) {
          errors.push(`${file.name}: Unsupported file type`);
          continue;
        }

        // Validate file size
        if (!validateFileSize(file, maxSizeMB)) {
          errors.push(`${file.name}: File size exceeds ${maxSizeMB}MB limit`);
          continue;
        }

        // Create DocumentFile object
        const documentFile: DocumentFile = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          file: file // Store the actual File object
        };

        console.log('Created document file:', documentFile.name, 'Type:', documentFile.type);
        validFiles.push(documentFile);
      }

      // Show errors if any
      if (errors.length > 0) {
        alert('Some files were rejected:\n' + errors.join('\n'));
      }

      // Add valid files
      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Error processing files. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [onFilesAdded, maxSizeMB]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    maxFiles,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    }
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive && !isDragReject ? 'border-blue-400 bg-blue-50' : ''}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
          ${!isDragActive ? 'border-gray-300 hover:border-gray-400' : ''}
          ${isProcessing ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div>
            {isProcessing ? (
              <p className="text-lg font-medium text-gray-600">Processing files...</p>
            ) : isDragActive ? (
              isDragReject ? (
                <p className="text-lg font-medium text-red-600">
                  Some files are not supported
                </p>
              ) : (
                <p className="text-lg font-medium text-blue-600">
                  Drop files here...
                </p>
              )
            ) : (
              <>
                <p className="text-lg font-medium text-gray-900">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Supports PDF, Excel, Word, PowerPoint, and text files
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Maximum {maxFiles} files, {maxSizeMB}MB per file
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 