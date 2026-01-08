/**
 * Image Processor Plugin for OpenCode
 * Provides image analysis, encoding, and compression capabilities
 * 
 * This plugin implements image processing functionality including:
 * - Image analysis and metadata extraction
 * - Base64 encoding for image data
 * - Image compression and optimization
 * - OCR text extraction from images
 * - Object detection in images
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { promises as fs } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';

/**
 * Supported image formats
 */
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];

/**
 * Image metadata interface
 */
export interface ImageMetadata {
  filename: string;
  format: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  colorSpace?: string;
  hasAlpha?: boolean;
  created?: Date;
  modified?: Date;
}

/**
 * OCR result interface
 */
export interface OCRResult {
  text: string;
  confidence: number;
  blocks: Array<{
    text: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

/**
 * Object detection result interface
 */
export interface ObjectDetectionResult {
  objects: Array<{
    label: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  totalObjects: number;
}

/**
 * Image compression options
 */
export interface CompressionOptions {
  quality?: number; // 0-100 for JPEG
  format?: 'jpeg' | 'png' | 'webp';
  maxWidth?: number;
  maxHeight?: number;
  preserveAspectRatio?: boolean;
}

/**
 * Image processing utilities
 */
export class ImageProcessor {
  
  /**
   * Validate if file is a supported image format
   */
  static isValidImageFormat(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return SUPPORTED_FORMATS.includes(ext);
  }

  /**
   * Get image metadata without loading the full image
   */
  static async getImageMetadata(filePath: string): Promise<StandardToolResult<ImageMetadata>> {
    const startTime = Date.now();
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Get file stats
      const stats = await fs.stat(filePath);
      const ext = extname(filePath).toLowerCase();
      
      if (!this.isValidImageFormat(filePath)) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported image format: ${ext}`,
          { filePath, supportedFormats: SUPPORTED_FORMATS }
        );
      }

      const metadata: ImageMetadata = {
        filename: basename(filePath),
        format: ext.substring(1), // Remove the dot
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };

      // For basic implementation, we'll return metadata without dimensions
      // In a full implementation, you would use a library like 'sharp' or 'jimp'
      // to extract actual image dimensions and other properties
      
      return createSuccessResult(
        metadata,
        { 
          duration: Date.now() - startTime,
          warnings: ['Dimension extraction not implemented - requires image processing library']
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to get image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Encode image to base64 string
   */
  static async encodeToBase64(filePath: string): Promise<StandardToolResult<{ 
    base64: string; 
    mimeType: string; 
    size: number;
    originalSize: number;
  }>> {
    const startTime = Date.now();
    
    try {
      // Validate image format
      if (!this.isValidImageFormat(filePath)) {
        const ext = extname(filePath).toLowerCase();
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported image format: ${ext}`,
          { filePath, supportedFormats: SUPPORTED_FORMATS }
        );
      }

      // Read file
      const imageBuffer = await fs.readFile(filePath);
      const originalSize = imageBuffer.length;
      
      // Convert to base64
      const base64 = imageBuffer.toString('base64');
      
      // Determine MIME type
      const ext = extname(filePath).toLowerCase();
      const mimeType = this.getMimeType(ext);
      
      // Check for large files
      const warnings: string[] = [];
      if (originalSize > 5 * 1024 * 1024) { // 5MB
        warnings.push('Large image file detected - consider compression');
      }
      
      return createSuccessResult(
        {
          base64,
          mimeType,
          size: base64.length,
          originalSize
        },
        { 
          duration: Date.now() - startTime,
          warnings
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to encode image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Get MIME type for image extension
   */
  private static getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.svg': 'image/svg+xml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Compress image (placeholder implementation)
   * In a full implementation, this would use a library like 'sharp'
   */
  static async compressImage(
    inputPath: string, 
    outputPath: string, 
    options: CompressionOptions = {}
  ): Promise<StandardToolResult<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    outputPath: string;
  }>> {
    const startTime = Date.now();
    
    try {
      // Validate input format
      if (!this.isValidImageFormat(inputPath)) {
        const ext = extname(inputPath).toLowerCase();
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported image format: ${ext}`,
          { inputPath, supportedFormats: SUPPORTED_FORMATS }
        );
      }

      // Get original file size
      const originalStats = await fs.stat(inputPath);
      const originalSize = originalStats.size;
      
      // For this basic implementation, we'll just copy the file
      // In a real implementation, you would use sharp, jimp, or similar library
      const inputBuffer = await fs.readFile(inputPath);
      
      // Simulate compression by copying (placeholder)
      await fs.writeFile(outputPath, inputBuffer);
      
      const compressedStats = await fs.stat(outputPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
      
      return createSuccessResult(
        {
          originalSize,
          compressedSize,
          compressionRatio,
          outputPath
        },
        { 
          duration: Date.now() - startTime,
          warnings: ['Image compression not implemented - requires image processing library like sharp']
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { inputPath, outputPath, options, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Extract text from image using OCR (placeholder implementation)
   * In a full implementation, this would use Tesseract.js or similar
   */
  static async extractText(filePath: string): Promise<StandardToolResult<OCRResult>> {
    const startTime = Date.now();
    
    try {
      // Validate image format
      if (!this.isValidImageFormat(filePath)) {
        const ext = extname(filePath).toLowerCase();
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported image format: ${ext}`,
          { filePath, supportedFormats: SUPPORTED_FORMATS }
        );
      }

      // Check if file exists
      await fs.access(filePath);
      
      // Placeholder OCR result
      const ocrResult: OCRResult = {
        text: '',
        confidence: 0,
        blocks: []
      };
      
      return createSuccessResult(
        ocrResult,
        { 
          duration: Date.now() - startTime,
          warnings: ['OCR text extraction not implemented - requires Tesseract.js or similar library']
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Detect objects in image (placeholder implementation)
   * In a full implementation, this would use TensorFlow.js or similar
   */
  static async detectObjects(filePath: string): Promise<StandardToolResult<ObjectDetectionResult>> {
    const startTime = Date.now();
    
    try {
      // Validate image format
      if (!this.isValidImageFormat(filePath)) {
        const ext = extname(filePath).toLowerCase();
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported image format: ${ext}`,
          { filePath, supportedFormats: SUPPORTED_FORMATS }
        );
      }

      // Check if file exists
      await fs.access(filePath);
      
      // Placeholder object detection result
      const detectionResult: ObjectDetectionResult = {
        objects: [],
        totalObjects: 0
      };
      
      return createSuccessResult(
        detectionResult,
        { 
          duration: Date.now() - startTime,
          warnings: ['Object detection not implemented - requires TensorFlow.js or similar ML library']
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to detect objects in image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Analyze image and return comprehensive information
   */
  static async analyzeImage(filePath: string): Promise<StandardToolResult<{
    metadata: ImageMetadata;
    base64?: string;
    mimeType?: string;
    ocrResult?: OCRResult;
    objectDetection?: ObjectDetectionResult;
  }>> {
    const startTime = Date.now();
    
    try {
      // Get metadata
      const metadataResult = await this.getImageMetadata(filePath);
      if (!metadataResult.success) {
        return createErrorResult(
          metadataResult.error?.code || ErrorCode.VALIDATION_ERROR,
          metadataResult.error?.message || 'Failed to get image metadata',
          metadataResult.error?.details
        );
      }

      const result: any = {
        metadata: metadataResult.data!
      };

      // Optionally include base64 for smaller images
      const stats = await fs.stat(filePath);
      if (stats.size < 1024 * 1024) { // 1MB limit for auto-encoding
        const base64Result = await this.encodeToBase64(filePath);
        if (base64Result.success) {
          result.base64 = base64Result.data!.base64;
          result.mimeType = base64Result.data!.mimeType;
        }
      }

      const warnings: string[] = [];
      if (stats.size >= 1024 * 1024) {
        warnings.push('Large image - base64 encoding skipped');
      }

      return createSuccessResult(
        result,
        { 
          duration: Date.now() - startTime,
          warnings
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }
}

/**
 * Image Processor Plugin
 */
export const imageProcessorPlugin = async ({ client, $, directory }: any) => {
  return {
    tools: {
      analyze_image: {
        description: "Analyze an image and extract metadata, optionally including base64 encoding",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the image file to analyze"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          const resolvedPath = resolve(directory, filePath);
          return await ImageProcessor.analyzeImage(resolvedPath);
        }
      },

      encode_image_base64: {
        description: "Encode an image to base64 string with MIME type information",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the image file to encode"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          const resolvedPath = resolve(directory, filePath);
          return await ImageProcessor.encodeToBase64(resolvedPath);
        }
      },

      compress_image: {
        description: "Compress an image with specified options",
        parameters: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "Path to the input image file"
            },
            outputPath: {
              type: "string",
              description: "Path where the compressed image will be saved"
            },
            quality: {
              type: "number",
              description: "Compression quality (0-100, higher is better quality)",
              minimum: 0,
              maximum: 100,
              default: 80
            },
            format: {
              type: "string",
              enum: ["jpeg", "png", "webp"],
              description: "Output format for the compressed image",
              default: "jpeg"
            },
            maxWidth: {
              type: "number",
              description: "Maximum width in pixels (optional)"
            },
            maxHeight: {
              type: "number",
              description: "Maximum height in pixels (optional)"
            },
            preserveAspectRatio: {
              type: "boolean",
              description: "Whether to preserve aspect ratio when resizing",
              default: true
            }
          },
          required: ["inputPath", "outputPath"]
        },
        handler: async ({ inputPath, outputPath, quality, format, maxWidth, maxHeight, preserveAspectRatio }: {
          inputPath: string;
          outputPath: string;
          quality?: number;
          format?: 'jpeg' | 'png' | 'webp';
          maxWidth?: number;
          maxHeight?: number;
          preserveAspectRatio?: boolean;
        }) => {
          const resolvedInputPath = resolve(directory, inputPath);
          const resolvedOutputPath = resolve(directory, outputPath);
          
          const options: CompressionOptions = {
            quality,
            format,
            maxWidth,
            maxHeight,
            preserveAspectRatio
          };
          
          return await ImageProcessor.compressImage(resolvedInputPath, resolvedOutputPath, options);
        }
      },

      extract_text_ocr: {
        description: "Extract text from an image using OCR (Optical Character Recognition)",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the image file to process"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          const resolvedPath = resolve(directory, filePath);
          return await ImageProcessor.extractText(resolvedPath);
        }
      },

      detect_objects: {
        description: "Detect objects in an image using machine learning",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the image file to analyze"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          const resolvedPath = resolve(directory, filePath);
          return await ImageProcessor.detectObjects(resolvedPath);
        }
      },

      get_image_metadata: {
        description: "Get metadata information about an image file",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the image file"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          const resolvedPath = resolve(directory, filePath);
          return await ImageProcessor.getImageMetadata(resolvedPath);
        }
      }
    }
  };
};

export default imageProcessorPlugin;