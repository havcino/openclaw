#!/bin/sh
set -e

# 颜色输出（可选，便于调试）
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 2. 启动 Privoxy 到后台
start_privoxy() {
    log_info "Starting Privoxy in background..."
    
    # 检查 Privoxy 是否已安装
    if ! command -v privoxy >/dev/null 2>&1; then
        log_error "Privoxy not found! Please install privoxy first."
        return 1
    fi
    
    # 启动 Privoxy（--no-daemon 确保它不会 fork）
    privoxy --no-daemon /etc/privoxy/config &
    PRIVOXY_PID=$!
    
    # 等待 Privoxy 启动并就绪
    log_info "Waiting for Privoxy to be ready..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while ! nc -z localhost 8118 2>/dev/null; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            log_error "Privoxy failed to start within ${MAX_RETRIES} seconds"
            return 1
        fi
        sleep 1
    done
    
    log_info "Privoxy started successfully (PID: $PRIVOXY_PID)"
    return 0
}

# 3. 清理函数（优雅关闭）
cleanup() {
    log_info "Shutting down..."
    
    # 停止 Privoxy
    if [ -n "$PRIVOXY_PID" ] && kill -0 $PRIVOXY_PID 2>/dev/null; then
        log_info "Stopping Privoxy (PID: $PRIVOXY_PID)..."
        kill -TERM $PRIVOXY_PID
        wait $PRIVOXY_PID
        log_info "Privoxy stopped"
    fi
    
    # 停止主进程（如果存在）
    if [ -n "$MAIN_PID" ] && kill -0 $MAIN_PID 2>/dev/null; then
        log_info "Stopping main process (PID: $MAIN_PID)..."
        kill -TERM $MAIN_PID
        wait $MAIN_PID
    fi
    
    log_info "Shutdown complete"
    exit 0
}

# 4. 主函数
main() {
    log_info "Starting container initialization..."
    
    # 设置信号捕获
    trap cleanup INT TERM QUIT
    
    # 执行 Privoxy 相关操作
    start_privoxy || {
        log_error "Failed to start Privoxy, exiting..."
        exit 1
    }
    
    # 检查是否有自定义命令
    if [ $# -eq 0 ]; then
        log_error "No command specified! Please provide the main program to run."
        log_error "Example: docker run your-image /your/main/program"
        exit 1
    fi
    
    log_info "Starting main program: $@"
    
    # 执行主程序（前台运行）
    exec "$@" &
    MAIN_PID=$!
    
    log_info "Main program started (PID: $MAIN_PID)"
    log_info "Container is running..."
    
    # 等待主进程
    wait $MAIN_PID
    EXIT_CODE=$?
    
    log_info "Main program exited with code: $EXIT_CODE"
    
    # 主进程结束后，清理 Privoxy
    cleanup
    
    exit $EXIT_CODE
}

# 运行主函数
main "$@"
