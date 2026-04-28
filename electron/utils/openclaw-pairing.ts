import { app, utilityProcess } from 'electron';
import { existsSync } from 'node:fs';
import { getOpenClawDir, getOpenClawEntryPath } from './paths';
import { logger } from './logger';
import { getUvMirrorEnv } from './uv-env';
import path from 'node:path';

interface PairingTimeoutConfig {
  default: number;
  telegram: number;
  discord: number;
  whatsapp: number;
  wechat: number;
  feishu: number;
  dingtalk: number;
  wecom: number;
  zalouser: number;
}

const PAIRING_TIMEOUT_CONFIG: PairingTimeoutConfig = {
  default: 300000, // 5 minutes
  telegram: 300000, // 5 minutes
  discord: 300000, // 5 minutes
  whatsapp: 600000, // 10 minutes
  wechat: 450000, // 7.5 minutes
  feishu: 300000, // 5 minutes
  dingtalk: 300000, // 5 minutes
  wecom: 600000, // 7.5 minutes
  zalouser: 300000, // 5 minutes
};

// Store active pairing processes by channel to allow cancellation
const activePairingProcesses = new Map<string, Electron.UtilityProcess>();

export interface PairingRequest {
  channel: string;
  accountId?: string;
  senderId: string;
  senderName?: string;
  code: string;
  timestamp: string;
}

/**
 * List pending DM pairing requests for a channel
 * @param channel - Channel name (e.g., 'telegram', 'discord', 'zalouser'). Optional if only one channel configured
 * @param account - Account ID for multi-account channels
 * @param json - Return JSON output instead of formatted text
 * @returns Pairing requests list
 */
export async function listPairingRequests(
  channel?: string,
  options?: {
    account?: string;
    json?: boolean;
  }
): Promise<{
  success: boolean;
  data?: PairingRequest[];
  error?: string;
  stdout?: string;
}> {
  const args = ['pairing', 'list'];

  if (channel) {
    args.push(channel);
  }

  if (options?.account) {
    args.push('--account', options.account);
  }

  if (options?.json) {
    args.push('--json');
  }

  const result = await executePairingCommand(args, channel);

  if (!result.success) {
    return { success: false, error: result.error, stdout: result.stdout };
  }

  try {
    if (options?.json) {
      const data = JSON.parse(result.stdout || '');
      return { success: true, data };
    }

    return { success: true, stdout: result.stdout };
  } catch (error) {
    logger.warn('Failed to parse pairing list output:', error);
    return { success: true, stdout: result.stdout };
  }
}

/**
 * Approve a DM pairing request with the provided code
 * @param channel - Channel name (e.g., 'telegram', 'discord', 'zalouser')
 * @param code - Pairing code received from the channel
 * @param options - Additional options
 * @returns Approval result
 */
export async function approvePairing(
  channel: string,
  code: string,
  options?: {
    account?: string;
    notify?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const args = ['pairing', 'approve', channel, code];

  if (options?.account) {
    args.push('--account', options.account);
  }

  if (options?.notify) {
    args.push('--notify');
  }

  const result = await executePairingCommand(args, channel);
  logger.info(
    `[approvePairing] Result: success=${result.success}, error=${result.error || 'none'}`
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

// 成功标识符常量
const PAIRING_SUCCESS_INDICATOR = 'Approved';

/**
 * Execute openclaw pairing command
 * @param args - Command arguments
 * @param channel - Optional channel name to determine timeout configuration
 * @returns Command execution result
 */
async function executePairingCommand(
  args: string[],
  channel?: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const openclawDir = getOpenClawDir();
  const entryScript = getOpenClawEntryPath();

  if (!existsSync(entryScript)) {
    const error = `OpenClaw entry script not found at ${entryScript}`;
    logger.error(`Cannot run OpenClaw pairing command: ${error}`);
    return {
      success: false,
      stdout: '',
      stderr: '',
      error,
    };
  }

  const binPath = getBundledBinPath();
  const binPathExists = existsSync(binPath);
  const finalPath = binPathExists
    ? `${binPath}${path.delimiter}${process.env.PATH || ''}`
    : process.env.PATH || '';

  const uvEnv = await getUvMirrorEnv();

  // Get timeout based on channel, fallback to default
  const timeoutMs =
    channel && channel in PAIRING_TIMEOUT_CONFIG
      ? PAIRING_TIMEOUT_CONFIG[channel as keyof typeof PAIRING_TIMEOUT_CONFIG]
      : PAIRING_TIMEOUT_CONFIG.default;

  // Cancel any existing pairing process for this channel
  if (channel) {
    const existingProcess = activePairingProcesses.get(channel);
    if (existingProcess) {
      logger.info(`Cancelling existing pairing process for channel: ${channel}`);
      try {
        existingProcess.kill();
        logger.info(`Existing pairing process for channel ${channel} terminated`);
      } catch (error) {
        logger.warn(`Failed to terminate existing pairing process for channel ${channel}:`, error);
      }
      activePairingProcesses.delete(channel);
    }
  }

  logger.info(
    `Running OpenClaw pairing command (channel=${channel || 'default'}, timeout=${timeoutMs}ms, args="${args.join(' ')}", cwd="${openclawDir}")`
  );

  return await new Promise((resolve) => {
    const child = utilityProcess.fork(entryScript, args, {
      cwd: openclawDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        ...uvEnv,
        PATH: finalPath,
        OPENCLAW_NO_RESPAWN: '1',
      } as NodeJS.ProcessEnv,
    });

    // Store the process reference for potential cancellation
    if (channel) {
      activePairingProcesses.set(channel, child);
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let successHandled = false;

    const finish = (result: {
      success: boolean;
      stdout: string;
      stderr: string;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;

      // 清理事件监听器
      child.stdout?.removeAllListeners('data');
      child.stderr?.removeAllListeners('data');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.removeAllListeners('message');

      resolve(result);
    };

    // 统一的进程终止函数
    const terminateProcess = (reason: string) => {
      if (settled) return;

      // 清除进程引用（如果还存在）
      if (channel) {
        activePairingProcesses.delete(channel);
      }

      // 使用 try-catch 包裹 kill 调用，避免进程已退出时报错
      try {
        child.kill();
        logger.info(`Pairing process terminated: ${reason}`);
      } catch (killError) {
        // 进程可能已经退出，忽略错误
        logger.debug(`Pairing process already exited (${reason}):`, killError);
      }
    };

    const timeout = setTimeout(() => {
      if (settled) return; // Already resolved, don't kill

      const errorMsg = `OpenClaw pairing command timed out after ${timeoutMs}ms for channel: ${channel || 'unknown'}`;
      logger.error(errorMsg);
      logger.error(`Command args: ${args.join(' ')}`);
      logger.error(`Stdout so far: ${stdout.substring(0, 500)}`);
      logger.error(`Stderr so far: ${stderr.substring(0, 500)}`);

      terminateProcess('timeout');

      // Give process 2 seconds to exit gracefully
      setTimeout(() => {
        if (!settled) {
          terminateProcess('timeout force kill');
        }
      }, 2000);

      finish({
        success: false,
        stdout,
        stderr,
        error: errorMsg,
      });
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      logger.info(`[stdout] --- ${data}`);
      stdout += data.toString();

      // 检测到成功标识符即认为配对成功
      if (!successHandled && data.toString().startsWith(PAIRING_SUCCESS_INDICATOR)) {
        successHandled = true;
        clearTimeout(timeout); // 清除超时定时器

        // 延迟3秒后关闭进程，给子进程时间完成清理工作
        setTimeout(() => {
          terminateProcess('success');
        }, 3000);

        // 立即返回成功结果
        finish({
          success: true,
          stdout,
          stderr,
        });
      }
    });

    child.stderr?.on('data', (data) => {
      logger.info(`[stderr] --- ${data}`);
      stderr += data.toString();
    });

    child.on('message', (data) => {
      logger.info(`[message] ----- ${data}`);
    });

    child.on('error', (error: unknown) => {
      clearTimeout(timeout);
      const errorMsg = `Failed to spawn OpenClaw pairing process: ${
        error instanceof Error ? error.message : String(error)
      }. Command: ${args.join(' ')}, CWD: ${openclawDir}`;
      logger.error(errorMsg);
      terminateProcess('spawn error');
      finish({
        success: false,
        stdout,
        stderr,
        error: errorMsg,
      });
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      logger.info(`OpenClaw pairing command exited with code ${code ?? 'null'}`);

      // Clear the process reference on exit
      if (channel) {
        activePairingProcesses.delete(channel);
      }

      // 仅在未检测到成功时才处理（防止与 stdout 成功处理冲突）
      if (!successHandled && !settled) {
        finish({
          success: code === 0,
          stdout,
          stderr,
        });
      }
    });
  });
}

function getBundledBinPath(): string {
  const target = `${process.platform}-${process.arch}`;
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(process.cwd(), 'resources', 'bin', target);
}
