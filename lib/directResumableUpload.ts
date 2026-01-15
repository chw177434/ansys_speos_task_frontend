/**
 * Direct 模式断点续传管理器
 * 
 * 功能：
 * 1. 分片上传大文件到服务器（内网直连）
 * 2. 支持断点续传
 * 3. 自动保存进度到 localStorage
 * 4. 支持暂停/恢复上传
 * 5. 支持取消上传
 * 
 * 与 TOS 模式的区别：
 * - Direct 模式：使用 FormData POST 到后端服务器
 * - TOS 模式：使用预签名 URL PUT 到对象存储
 */

import {
  CHUNK_SIZE,
  initDirectMultipartUpload,
  uploadDirectPart,
  completeDirectMultipartUpload,
  listDirectUploadedParts,
  saveDirectUploadProgress,
  loadDirectUploadProgress,
  clearDirectUploadProgress,
  type DirectMultipartInitResponse,
} from "./api";

/**
 * 根据文件名自动判断文件类型
 * 
 * 规则：
 * - Master 文件：必须是 .speos 或 .sv5 文件
 * - Include 文件：必须是压缩包格式（.zip, .rar, .7z, .tar, .gz, .tar.gz）
 * 
 * @param filename 文件名
 * @returns "master" | "include"
 */
export function detectFileTypeFromFilename(filename: string): "master" | "include" {
  const filenameLower = filename.toLowerCase();
  
  // 压缩包格式 → include
  // 注意：先检查 .tar.gz（因为它是 .gz 的超集）
  const archiveExts = ['.tar.gz', '.zip', '.rar', '.7z', '.tar', '.gz'];
  for (const ext of archiveExts) {
    if (filenameLower.endsWith(ext)) {
      return 'include';
    }
  }
  
  // Master 文件格式 → master
  if (filenameLower.endsWith('.speos') || filenameLower.endsWith('.sv5')) {
    return 'master';
  }
  
  // 默认返回 master（向后兼容）
  return 'master';
}

export interface DirectResumableUploadOptions {
  file: File | Blob;
  filename: string;
  fileType: "master" | "include";
  
  // 可选：用于断点续传
  existingTaskId?: string;
  existingUploadId?: string;
  
  // 回调函数
  onProgress?: (info: DirectUploadProgressInfo) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onComplete?: (result: DirectUploadResult) => void;
  onError?: (error: Error) => void;
  
  // 取消信号
  abortSignal?: AbortSignal;
}

export interface DirectUploadProgressInfo {
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

export interface DirectUploadResult {
  taskId: string;
  uploadId: string;
  filePath: string;
  fileType: "master" | "include";
}

export class DirectResumableUploadManager {
  private file: File | Blob;
  private filename: string;
  private fileType: "master" | "include";
  
  private taskId: string | null = null;
  private uploadId: string | null = null;
  
  private totalChunks: number = 0;
  private uploadedParts: number[] = [];
  private allParts: Array<{
    part_number: number;
    start_byte: number;
    end_byte: number;
    size: number;
  }> = [];
  
  private startTime: number = 0;
  private uploadedBytes: number = 0;
  
  private onProgress?: (info: DirectUploadProgressInfo) => void;
  private onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  private onComplete?: (result: DirectUploadResult) => void;
  private onError?: (error: Error) => void;
  
  private abortSignal?: AbortSignal;
  private isPaused: boolean = false;
  
  constructor(options: DirectResumableUploadOptions) {
    this.file = options.file;
    this.filename = options.filename;
    this.fileType = options.fileType;
    
    this.taskId = options.existingTaskId || null;
    this.uploadId = options.existingUploadId || null;
    
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
      const result = await this.completeUpload();
      
      // 步骤 5: 清除进度
      this.clearProgress();
      
      // 通知完成
      if (this.onComplete && this.taskId && this.uploadId) {
        this.onComplete({
          taskId: this.taskId,
          uploadId: this.uploadId,
          filePath: result.file_path,
          fileType: this.fileType,
        });
      }
    } catch (error) {
      console.error("[Direct] 断点续传上传失败", error);
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
    console.log("[Direct] ⏸️ 上传已暂停");
  }
  
  /**
   * 恢复上传
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    console.log("[Direct] ▶️ 恢复上传");
    await this.uploadAllChunks();
  }
  
  /**
   * 取消上传
   */
  async cancel(): Promise<void> {
    try {
      if (this.taskId) {
        this.clearProgress();
        console.log("[Direct] 🚫 上传已取消");
      }
    } catch (error) {
      console.warn("[Direct] 取消上传失败", error);
    }
  }
  
  /**
   * 初始化上传
   */
  private async initializeUpload(): Promise<void> {
    // ⚡ 步骤 0: 检测文件类型并记录日志（不阻止，让后端自动修正）
    const detectedFileType = detectFileTypeFromFilename(this.filename);
    
    // 记录文件类型检测结果
    console.log(`[Direct] 📋 文件类型检测:`);
    console.log(`  - 文件名: ${this.filename}`);
    console.log(`  - 传入的 file_type: ${this.fileType}`);
    console.log(`  - 检测到的类型: ${detectedFileType}`);
    
    // ⚠️ 如果 file_type="master" 但文件是压缩包，记录警告（后端会自动修正为 "include"）
    if (this.fileType === "master" && detectedFileType === "include") {
      console.warn(
        `⚠️ [Direct] 文件类型可能不匹配（后端将自动修正）：\n` +
        `  - 文件名: ${this.filename} (压缩包格式)\n` +
        `  - 传入的 file_type: ${this.fileType} (master)\n` +
        `  - 检测到的类型: ${detectedFileType} (include)\n` +
        `  - 后端将自动将 file_type 修正为 "include" 并继续处理\n` +
        `  - 建议：Master 文件应该是 .speos 或 .sv5 文件，zip 文件应作为 Include 文件上传`
      );
      // 不抛出错误，让后端自动修正
    }
    
    // ❌ 如果 file_type="include" 但文件不是压缩包，必须阻止（后端会报错）
    if (this.fileType === "include" && detectedFileType === "master") {
      const errorMessage = 
        `❌ [Direct] 错误：Include 文件必须是压缩包格式！\n` +
        `文件名: ${this.filename}\n` +
        `检测到的类型: ${detectedFileType} (.speos/.sv5)\n` +
        `传入的类型: ${this.fileType} (include)\n\n` +
        `Include 文件必须是压缩包格式（.zip, .rar, .7z, .tar, .gz, .tar.gz）\n` +
        `如果这是 Master 文件，请选择正确的文件类型。`;
      
      console.error(errorMessage);
      throw new Error(`Include file must be an archive file. Found: ${this.filename}. Include file must be a .zip, .rar, .7z, .tar, .gz, or .tar.gz file.`);
    }
    
    if (detectedFileType === this.fileType) {
      console.log(`✅ [Direct] 文件类型匹配：文件名与 file_type 一致`);
    }
    
    // 如果已有 task_id，尝试加载进度
    if (this.taskId) {
      const savedProgress = loadDirectUploadProgress(this.taskId, this.fileType);
      if (savedProgress) {
        // ⚡ 严格验证恢复的进度数据是否正确
        const savedDetectedType = detectFileTypeFromFilename(savedProgress.filename);
        const isValidProgress = 
          savedProgress.filename === this.filename &&  // 文件名必须完全匹配
          savedProgress.file_size === this.file.size &&  // 文件大小必须匹配
          savedProgress.file_type === this.fileType &&  // file_type 必须匹配
          savedDetectedType === this.fileType;  // 恢复的文件名检测出的类型必须与当前 file_type 匹配
        
        if (!isValidProgress) {
          console.warn(
            `⚠️ [Direct] 恢复的进度数据不匹配，清除错误的进度记录：\n` +
            `当前文件: ${this.filename} (${this.file.size} bytes, ${this.fileType})\n` +
            `恢复进度: ${savedProgress.filename} (${savedProgress.file_size} bytes, ${savedProgress.file_type})\n` +
            `文件名检测类型: ${savedDetectedType}\n` +
            `将清除错误的进度并重新初始化`
          );
          
          // 清除错误的进度
          clearDirectUploadProgress(this.taskId, this.fileType);
          
          // 继续执行新的初始化流程
        } else {
          // 验证通过，恢复进度
          this.uploadId = savedProgress.upload_id;
          this.totalChunks = savedProgress.total_chunks;
          this.uploadedParts = savedProgress.uploaded_parts;
          console.log(
            `✅ [Direct] 恢复上传进度验证通过：\n` +
            `  - 文件名: ${savedProgress.filename}\n` +
            `  - 文件大小: ${this.formatBytes(savedProgress.file_size)}\n` +
            `  - 文件类型: ${savedProgress.file_type}\n` +
            `  - 已上传: ${this.uploadedParts.length}/${this.totalChunks} 片`
          );
          return;
        }
      }
    }
    
    // 初始化新的分片上传
    console.log(`[Direct] 🚀 初始化分片上传: ${this.filename} (${this.formatBytes(this.file.size)})`);
    console.log(`[Direct] 📋 请求信息:`);
    console.log(`  - 文件名: ${this.filename}`);
    console.log(`  - 文件大小: ${this.formatBytes(this.file.size)}`);
    console.log(`  - 传入的 file_type: ${this.fileType}`);
    console.log(`  - 检测到的类型: ${detectedFileType}`);
    
    // 如果文件类型可能不匹配，记录提示信息
    if (this.fileType === "master" && detectedFileType === "include") {
      console.log(`ℹ️ [Direct] 注意：后端将自动将 file_type 从 "master" 修正为 "include"`);
    }
    
    const initRequest: any = {
      filename: this.filename,
      file_size: this.file.size,
      file_type: this.fileType,  // 传入原始 file_type，后端会自动修正
      chunk_size: CHUNK_SIZE,
    };
    
    // 如果已有 task_id（例如 include 文件需要使用与 master 相同的 task_id），传递给后端
    if (this.taskId) {
      initRequest.task_id = this.taskId;
      console.log(`[Direct] 📌 使用指定的 task_id: ${this.taskId}`);
    }
    
    const initResponse = await initDirectMultipartUpload(initRequest);
    
    // ⚡ 关键验证：根据后端规范，如果传递了 task_id，返回的 task_id 应该与传递的完全一致
    // 如果返回了不同的 task_id，说明后端可能不支持该参数或有问题
    if (this.taskId && initResponse.task_id !== this.taskId) {
      const errorMsg = 
        `❌ [Direct] 严重错误：后端返回了不同的 task_id！这不符合后端规范。\n` +
        `  请求的 task_id: ${this.taskId}\n` +
        `  返回的 task_id: ${initResponse.task_id}\n` +
        `  文件名: ${this.filename}\n` +
        `  文件类型: ${this.fileType}\n` +
        `\n后端应该返回与请求相同的 task_id。这会导致文件存储在不同目录，提交任务时找不到文件！\n` +
        `虽然后端有跨目录查找容错机制，但这不是最佳实践。`;
      
      console.error(errorMsg);
      
      // ⚡ 重要决策：如果后端返回了不同的 task_id，我们有两个选择：
      // 1. 使用请求的 task_id（可能导致文件找不到）
      // 2. 使用返回的 task_id（可能导致提交任务时找不到文件）
      // 这里我们使用返回的 task_id，因为文件已经存储在该目录下
      // 但会在日志中记录警告，提醒开发者检查后端实现
      console.warn(
        `⚠️ [Direct] 将使用后端返回的 task_id: ${initResponse.task_id}\n` +
        `  注意：提交任务时必须使用这个 task_id，否则会找不到文件！`
      );
    } else if (this.taskId && initResponse.task_id === this.taskId) {
      console.log(`✅ [Direct] 后端正确返回了请求的 task_id: ${this.taskId}`);
    } else if (!this.taskId) {
      console.log(`✅ [Direct] 后端创建了新的 task_id: ${initResponse.task_id}`);
    }
    
    // ⚡ 保存原始请求的 task_id（如果存在），用于后续验证
    const requestedTaskId = this.taskId;
    
    this.taskId = initResponse.task_id;
    this.uploadId = initResponse.upload_id;
    this.totalChunks = initResponse.total_chunks;
    this.allParts = initResponse.parts;
    
    console.log(`[Direct] ✅ 初始化成功:`);
    console.log(`  - taskId: ${this.taskId}`);
    console.log(`  - uploadId: ${this.uploadId}`);
    console.log(`  - 总分片: ${this.totalChunks}`);
    console.log(`  - 文件名: ${this.filename}`);
    console.log(`  - 文件类型: ${this.fileType}`);
    if (requestedTaskId && requestedTaskId !== this.taskId) {
      console.log(`  - ⚠️ 请求的 task_id: ${requestedTaskId} (与返回的不一致)`);
    }
  }
  
  /**
   * 检查已上传的分片
   */
  private async checkExistingParts(): Promise<void> {
    if (!this.taskId || !this.uploadId) {
      throw new Error("[Direct] 未初始化上传");
    }
    
    if (this.uploadedParts.length > 0) {
      console.log(`[Direct] 📊 本地记录显示已上传 ${this.uploadedParts.length} 片`);
      return;
    }
    
    try {
      const listResponse = await listDirectUploadedParts({
        task_id: this.taskId,
        upload_id: this.uploadId,
      });
      
      this.uploadedParts = listResponse.parts;
      
      if (this.uploadedParts.length > 0) {
        console.log(`[Direct] 📊 服务器记录显示已上传 ${this.uploadedParts.length} 片，跳过这些分片`);
        
        // 计算已上传的字节数（根据实际的 parts 信息计算，考虑最后一个分片可能小于 CHUNK_SIZE）
        this.uploadedBytes = 0;
        const uploadedPartNumbers = new Set(this.uploadedParts);
        for (const part of this.allParts) {
          if (uploadedPartNumbers.has(part.part_number)) {
            this.uploadedBytes += part.size;
          }
        }
      }
    } catch (error) {
      console.warn("[Direct] 查询已上传分片失败，将从头开始上传", error);
      this.uploadedParts = [];
    }
  }
  
  /**
   * 上传所有分片
   */
  private async uploadAllChunks(): Promise<void> {
    if (!this.taskId || !this.uploadId) {
      throw new Error("[Direct] 未初始化上传");
    }
    
    const uploadedPartNumbers = new Set(this.uploadedParts);
    
    for (let i = 0; i < this.allParts.length; i++) {
      // 检查是否暂停
      if (this.isPaused) {
        console.log("[Direct] ⏸️ 上传已暂停，保存进度");
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
        console.log(`[Direct] ⏭️ 跳过已上传的分片 ${part.part_number}/${this.totalChunks}`);
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
    
    console.log(`[Direct] ✅ 所有分片上传完成 (${this.uploadedParts.length}/${this.totalChunks})`);
  }
  
  /**
   * 上传单个分片
   */
  private async uploadChunk(part: {
    part_number: number;
    start_byte: number;
    end_byte: number;
    size: number;
  }): Promise<void> {
    const { part_number, start_byte, end_byte, size } = part;
    
    if (!this.taskId || !this.uploadId) {
      throw new Error("[Direct] 未初始化上传");
    }
    
    // 切片文件
    const chunk = this.file.slice(start_byte, end_byte);
    
    console.log(`[Direct] ⬆️ 上传分片 ${part_number}/${this.totalChunks} (${this.formatBytes(size)})`);
    
    const chunkStartTime = Date.now();
    
    // 上传分片
    await uploadDirectPart(
      this.taskId,
      this.uploadId,
      part_number,
      chunk,
      (loaded, total) => {
        // 更新进度
        this.updateProgress(part_number, loaded, total);
      },
      this.abortSignal
    );
    
    const chunkTime = (Date.now() - chunkStartTime) / 1000;
    const chunkSpeed = size / chunkTime;
    
    console.log(`[Direct] ✅ 分片 ${part_number} 上传成功, 速度=${this.formatSpeed(chunkSpeed)}`);
    
    // 保存分片编号
    this.uploadedParts.push(part_number);
    
    // 更新已上传字节数
    this.uploadedBytes += size;
  }
  
  /**
   * 完成上传
   */
  private async completeUpload(): Promise<{ message: string; file_path: string }> {
    if (!this.taskId || !this.uploadId) {
      throw new Error("[Direct] 未初始化上传");
    }
    
    console.log(`[Direct] 🏁 完成上传，合并所有分片...`);
    
    // 按 part_number 排序
    const sortedPartNumbers = [...this.uploadedParts].sort((a, b) => a - b);
    
    const result = await completeDirectMultipartUpload({
      task_id: this.taskId,
      upload_id: this.uploadId,
      filename: this.filename,
      file_type: this.fileType,
      parts: sortedPartNumbers.map(part_number => ({ part_number })),
    });
    
    console.log(`[Direct] ✅ 分片上传完成: ${this.filename}, 文件路径: ${result.file_path}`);
    
    return result;
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
    if (!this.taskId || !this.uploadId) return;
    
    saveDirectUploadProgress({
      task_id: this.taskId,
      upload_id: this.uploadId,
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
      clearDirectUploadProgress(this.taskId, this.fileType);
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
 * 便捷函数：上传文件（Direct 模式分片上传）
 */
export async function uploadFileWithDirectResumable(
  file: File | Blob,
  filename: string,
  fileType: "master" | "include",
  options?: {
    existingTaskId?: string;
    existingUploadId?: string;
    onProgress?: (info: DirectUploadProgressInfo) => void;
    onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
    abortSignal?: AbortSignal;
  }
): Promise<DirectUploadResult> {
  return new Promise((resolve, reject) => {
    const manager = new DirectResumableUploadManager({
      file,
      filename,
      fileType,
      existingTaskId: options?.existingTaskId,
      existingUploadId: options?.existingUploadId,
      onProgress: options?.onProgress,
      onChunkComplete: options?.onChunkComplete,
      onComplete: resolve,
      onError: reject,
      abortSignal: options?.abortSignal,
    });
    
    manager.start();
  });
}

