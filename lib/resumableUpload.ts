/**
 * 断点续传管理器
 * 
 * 功能：
 * 1. 分片上传大文件
 * 2. 支持断点续传
 * 3. 自动保存进度到 localStorage
 * 4. 支持暂停/恢复上传
 * 5. 支持取消上传
 */

import {
  CHUNK_SIZE,
  initMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  listUploadedParts,
  abortMultipartUpload,
  saveUploadProgress,
  loadUploadProgress,
  clearUploadProgress,
  type PartETag,
  type MultipartPart,
} from "./api";

export interface ResumableUploadOptions {
  file: File | Blob;
  filename: string;
  fileType: "master" | "include";
  contentType?: string;
  
  // 可选：用于断点续传
  existingTaskId?: string;
  existingUploadId?: string;
  existingObjectKey?: string;
  
  // 回调函数
  onProgress?: (info: UploadProgressInfo) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onComplete?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
  
  // 取消信号
  abortSignal?: AbortSignal;
}

export interface UploadProgressInfo {
  taskId: string;
  uploadId: string;
  filename: string;
  totalChunks: number;
  uploadedChunks: number;
  currentChunk: number;
  progress: number; // 0-100
  speed: number; // bytes per second
  estimatedTime: number; // seconds
  uploadedBytes: number;
  totalBytes: number;
}

export interface UploadResult {
  taskId: string;
  uploadId: string;
  objectKey: string;
  fileType: "master" | "include";
}

export class ResumableUploadManager {
  private file: File | Blob;
  private filename: string;
  private fileType: "master" | "include";
  private contentType: string;
  
  private taskId: string | null = null;
  private uploadId: string | null = null;
  private objectKey: string | null = null;
  
  private totalChunks: number = 0;
  private uploadedParts: PartETag[] = [];
  private allParts: MultipartPart[] = [];
  
  private startTime: number = 0;
  private uploadedBytes: number = 0;
  
  private onProgress?: (info: UploadProgressInfo) => void;
  private onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  private onComplete?: (result: UploadResult) => void;
  private onError?: (error: Error) => void;
  
  private abortSignal?: AbortSignal;
  private isPaused: boolean = false;
  
  constructor(options: ResumableUploadOptions) {
    this.file = options.file;
    this.filename = options.filename;
    this.fileType = options.fileType;
    this.contentType = options.contentType || "application/octet-stream";
    
    this.taskId = options.existingTaskId || null;
    this.uploadId = options.existingUploadId || null;
    this.objectKey = options.existingObjectKey || null;
    
    this.onProgress = options.onProgress;
    this.onChunkComplete = options.onChunkComplete;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    
    this.abortSignal = options.abortSignal;
  }
  
  /**
   * 开始上传
   */
  async start(): Promise<void> {
    try {
      this.startTime = Date.now();
      
      // 步骤 1: 初始化或恢复上传
      await this.initializeUpload();
      
      // 步骤 2: 检查是否有已上传的分片（断点续传）
      await this.checkExistingParts();
      
      // 步骤 3: 上传所有分片
      await this.uploadAllChunks();
      
      // 步骤 4: 完成上传
      await this.completeUpload();
      
      // 步骤 5: 清除进度
      this.clearProgress();
      
      // 通知完成
      if (this.onComplete && this.taskId && this.uploadId && this.objectKey) {
        this.onComplete({
          taskId: this.taskId,
          uploadId: this.uploadId,
          objectKey: this.objectKey,
          fileType: this.fileType,
        });
      }
    } catch (error) {
      console.error("断点续传上传失败", error);
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }
  
  /**
   * 暂停上传
   */
  pause(): void {
    this.isPaused = true;
    console.log("⏸️ 上传已暂停");
  }
  
  /**
   * 恢复上传
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    console.log("▶️ 恢复上传");
    await this.uploadAllChunks();
  }
  
  /**
   * 取消上传
   */
  async cancel(): Promise<void> {
    try {
      if (this.taskId && this.uploadId && this.objectKey) {
        await abortMultipartUpload({
          task_id: this.taskId,
          upload_id: this.uploadId,
          object_key: this.objectKey,
        });
        this.clearProgress();
        console.log("🚫 上传已取消");
      }
    } catch (error) {
      console.warn("取消上传失败", error);
    }
  }
  
  /**
   * 初始化上传
   */
  private async initializeUpload(): Promise<void> {
    // 如果已有 task_id，尝试加载进度
    if (this.taskId) {
      const savedProgress = loadUploadProgress(this.taskId, this.fileType);
      if (savedProgress) {
        this.uploadId = savedProgress.upload_id;
        this.objectKey = savedProgress.object_key;
        this.totalChunks = savedProgress.total_chunks;
        this.uploadedParts = savedProgress.uploaded_parts;
        console.log(`📥 恢复上传: ${savedProgress.filename}, 已上传 ${this.uploadedParts.length}/${this.totalChunks} 片`);
        return;
      }
    }
    
    // 初始化新的分片上传
    console.log(`🚀 初始化分片上传: ${this.filename} (${this.formatBytes(this.file.size)})`);
    
    const initResponse = await initMultipartUpload({
      filename: this.filename,
      file_size: this.file.size,
      file_type: this.fileType,
      content_type: this.contentType,
      chunk_size: CHUNK_SIZE,
    });
    
    this.taskId = initResponse.task_id;
    this.uploadId = initResponse.upload_id;
    this.objectKey = initResponse.object_key;
    this.totalChunks = initResponse.total_chunks;
    this.allParts = initResponse.parts;
    
    console.log(`✅ 初始化成功: taskId=${this.taskId}, uploadId=${this.uploadId}, 总分片=${this.totalChunks}`);
  }
  
  /**
   * 检查已上传的分片
   */
  private async checkExistingParts(): Promise<void> {
    if (!this.taskId || !this.uploadId || !this.objectKey) {
      throw new Error("未初始化上传");
    }
    
    if (this.uploadedParts.length > 0) {
      console.log(`📊 本地记录显示已上传 ${this.uploadedParts.length} 片`);
      return;
    }
    
    try {
      const listResponse = await listUploadedParts({
        task_id: this.taskId,
        upload_id: this.uploadId,
        object_key: this.objectKey,
      });
      
      this.uploadedParts = listResponse.parts;
      
      if (this.uploadedParts.length > 0) {
        console.log(`📊 服务器记录显示已上传 ${this.uploadedParts.length} 片，跳过这些分片`);
        
        // 计算已上传的字节数
        this.uploadedBytes = this.uploadedParts.length * CHUNK_SIZE;
      }
    } catch (error) {
      console.warn("查询已上传分片失败，将从头开始上传", error);
      this.uploadedParts = [];
    }
  }
  
  /**
   * 上传所有分片
   */
  private async uploadAllChunks(): Promise<void> {
    if (!this.taskId || !this.uploadId || !this.objectKey) {
      throw new Error("未初始化上传");
    }
    
    const uploadedPartNumbers = new Set(this.uploadedParts.map(p => p.part_number));
    
    for (let i = 0; i < this.allParts.length; i++) {
      // 检查是否暂停
      if (this.isPaused) {
        console.log("⏸️ 上传已暂停，保存进度");
        this.saveProgress();
        return;
      }
      
      // 检查是否取消
      if (this.abortSignal?.aborted) {
        throw new Error("上传已取消");
      }
      
      const part = this.allParts[i];
      
      // 跳过已上传的分片
      if (uploadedPartNumbers.has(part.part_number)) {
        console.log(`⏭️ 跳过已上传的分片 ${part.part_number}/${this.totalChunks}`);
        continue;
      }
      
      // 上传分片
      await this.uploadChunk(part);
      
      // 保存进度
      this.saveProgress();
      
      // 通知分片完成
      if (this.onChunkComplete) {
        this.onChunkComplete(part.part_number, this.totalChunks);
      }
    }
    
    console.log(`✅ 所有分片上传完成 (${this.uploadedParts.length}/${this.totalChunks})`);
  }
  
  /**
   * 上传单个分片
   */
  private async uploadChunk(part: MultipartPart): Promise<void> {
    const { part_number, upload_url, start_byte, end_byte, size } = part;
    
    // 切片文件
    const chunk = this.file.slice(start_byte, end_byte);
    
    console.log(`⬆️ 上传分片 ${part_number}/${this.totalChunks} (${this.formatBytes(size)})`);
    
    const chunkStartTime = Date.now();
    
    // 上传分片并获取 ETag
    const etag = await uploadPart(
      upload_url,
      chunk,
      (loaded, total) => {
        // 更新进度
        this.updateProgress(part_number, loaded, total);
      },
      this.abortSignal
    );
    
    const chunkTime = (Date.now() - chunkStartTime) / 1000;
    const chunkSpeed = size / chunkTime;
    
    console.log(`✅ 分片 ${part_number} 上传成功, ETag=${etag}, 速度=${this.formatSpeed(chunkSpeed)}`);
    
    // 保存 ETag
    this.uploadedParts.push({
      part_number,
      etag,
    });
    
    // 更新已上传字节数
    this.uploadedBytes += size;
  }
  
  /**
   * 完成上传
   */
  private async completeUpload(): Promise<void> {
    if (!this.taskId || !this.uploadId || !this.objectKey) {
      throw new Error("未初始化上传");
    }
    
    console.log(`🏁 完成上传，合并所有分片...`);
    
    // 按 part_number 排序
    const sortedParts = [...this.uploadedParts].sort((a, b) => a.part_number - b.part_number);
    
    await completeMultipartUpload({
      task_id: this.taskId,
      upload_id: this.uploadId,
      object_key: this.objectKey,
      file_type: this.fileType,
      parts: sortedParts,
    });
    
    console.log(`✅ 分片上传完成: ${this.filename}`);
  }
  
  /**
   * 更新进度
   */
  private updateProgress(currentChunkNumber: number, loaded: number, total: number): void {
    if (!this.taskId || !this.uploadId) return;
    
    const previousChunksBytes = (currentChunkNumber - 1) * CHUNK_SIZE;
    const currentBytes = previousChunksBytes + loaded;
    
    const progress = Math.round((currentBytes / this.file.size) * 100);
    
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    const speed = currentBytes / elapsedTime;
    const remainingBytes = this.file.size - currentBytes;
    const estimatedTime = speed > 0 ? remainingBytes / speed : 0;
    
    if (this.onProgress) {
      this.onProgress({
        taskId: this.taskId,
        uploadId: this.uploadId,
        filename: this.filename,
        totalChunks: this.totalChunks,
        uploadedChunks: this.uploadedParts.length,
        currentChunk: currentChunkNumber,
        progress,
        speed,
        estimatedTime,
        uploadedBytes: currentBytes,
        totalBytes: this.file.size,
      });
    }
  }
  
  /**
   * 保存进度到 localStorage
   */
  private saveProgress(): void {
    if (!this.taskId || !this.uploadId || !this.objectKey) return;
    
    saveUploadProgress({
      task_id: this.taskId,
      upload_id: this.uploadId,
      object_key: this.objectKey,
      file_type: this.fileType,
      filename: this.filename,
      file_size: this.file.size,
      total_chunks: this.totalChunks,
      uploaded_parts: this.uploadedParts,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 清除进度
   */
  private clearProgress(): void {
    if (this.taskId) {
      clearUploadProgress(this.taskId, this.fileType);
    }
  }
  
  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
  
  /**
   * 格式化速度
   */
  private formatSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + "/s";
  }
}

/**
 * 便捷函数：上传文件（自动选择普通上传或分片上传）
 */
export async function uploadFileWithResumable(
  file: File | Blob,
  filename: string,
  fileType: "master" | "include",
  options?: {
    existingTaskId?: string;
    existingUploadId?: string;
    existingObjectKey?: string;
    onProgress?: (info: UploadProgressInfo) => void;
    onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
    abortSignal?: AbortSignal;
  }
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const manager = new ResumableUploadManager({
      file,
      filename,
      fileType,
      existingTaskId: options?.existingTaskId,
      existingUploadId: options?.existingUploadId,
      existingObjectKey: options?.existingObjectKey,
      onProgress: options?.onProgress,
      onChunkComplete: options?.onChunkComplete,
      onComplete: resolve,
      onError: reject,
      abortSignal: options?.abortSignal,
    });
    
    manager.start();
  });
}

