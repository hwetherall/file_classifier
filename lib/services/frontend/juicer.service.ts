// Juicer API Service for file processing

// Types for the API responses - direct JSON response (parsed file content)
export type JuicerUploadResponse = any; // The parsed file content as JSON

export interface JuicerServiceError {
  error: string;
  message?: string;
  status?: number;
}

/**
 * Uploads a file to the Juicer API endpoint using File object
 * @param file - The file to upload (File object)
 * @returns Promise<JuicerUploadResponse> - The parsed file content as JSON
 */
export async function uploadFileToJuicer(file: File): Promise<JuicerUploadResponse> {
  // Validate file input
  if (!file) {
    throw new Error('No file provided');
  }

  // Create FormData object for multipart/form-data request
  const formData = new FormData();
  formData.append('file', file);

  // Log the upload attempt
  console.log(`Uploading file to Juicer API: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

  // Make the API request
  const response = await fetch(`${process.env.NEXT_PUBLIC_JUICER_API_URL}/upload-file`, {
    method: 'POST',
    body: formData,
  });

  // Check if the response is ok
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorData}`);
  }

  // Parse and return the response directly (parsed file content)
  const data = await response.json();
  console.log('File uploaded and parsed successfully by Juicer API');
  
  return data;
}

/**
 * Uploads multiple files to the Juicer API endpoint
 * @param files - Array of files to upload
 * @returns Promise<{filename: string, data?: JuicerUploadResponse, error?: string}[]> - Array of results
 */
export async function uploadMultipleFilesToJuicer(files: File[]): Promise<{filename: string, data?: JuicerUploadResponse, error?: string}[]> {
  console.log(`Uploading ${files.length} files to Juicer API`);
  
  // Upload files concurrently
  const uploadPromises = files.map(async (file) => {
    try {
      const data = await uploadFileToJuicer(file);
      return { filename: file.name, data };
    } catch (error: any) {
      console.error(`Failed to upload file ${file.name}:`, error);
      return { filename: file.name, error: error.message || 'Upload failed' };
    }
  });
  
  const results = await Promise.all(uploadPromises);
  
  const successCount = results.filter(r => !r.error).length;
  console.log(`Uploaded ${successCount}/${files.length} files successfully to Juicer API`);
  
  return results;
}
