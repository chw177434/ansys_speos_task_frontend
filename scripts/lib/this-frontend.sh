#!/bin/bash

# 只识别、停止「本仓库前端」进程。
# 判定条件：命令行指向本工程的 node_modules/next，或工作目录在本工程内且命令行是 next dev / next-server。
# 不会按进程名全局 pkill，也不会按端口段结束其他应用。

if [[ -z "${PROJECT_ROOT:-}" ]]; then
    echo "this-frontend.sh: PROJECT_ROOT is not set" >&2
    return 1 2>/dev/null || exit 1
fi

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
THIS_FRONTEND_PORT="${PORT:-3000}"
THIS_FRONTEND_PID_FILE="${PROJECT_ROOT}/nextjs-dev.pid"

_tf_cmdline() {
    local pid="$1"
    if [[ -r "/proc/${pid}/cmdline" ]]; then
        tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null || true
        return
    fi
    ps -p "$pid" -o args= 2>/dev/null || true
}

_tf_cwd() {
    local pid="$1"
    if [[ -e "/proc/${pid}/cwd" ]]; then
        readlink -f "/proc/${pid}/cwd" 2>/dev/null || true
    fi
}

_tf_is_protected_pid() {
    local pid="$1"
    local parent="$PPID"
    [[ "$pid" == "$$" || "$pid" == "$parent" ]]
}

# 本工程前端进程（不含仅凭端口判断）
this_frontend_owns_pid() {
    local pid="$1"
    local cmd cwd

    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    _tf_is_protected_pid "$pid" && return 1
    ps -p "$pid" >/dev/null 2>&1 || return 1

    cmd="$(_tf_cmdline "$pid")"
    cwd="$(_tf_cwd "$pid")"
    [[ -n "$cmd" || -n "$cwd" ]] || return 1

    if [[ "$cmd" == *"${PROJECT_ROOT}/node_modules/next"* || "$cmd" == *"${PROJECT_ROOT}/node_modules/.bin/next"* ]]; then
        return 0
    fi

    if [[ "$cwd" == "$PROJECT_ROOT" || "$cwd" == "$PROJECT_ROOT/"* ]]; then
        if [[ "$cmd" == *"next dev"* || "$cmd" == *"next-server"* || "$cmd" == *"next/dist/"* ]]; then
            return 0
        fi
    fi

    return 1
}

# PID 文件里的 npm/node 启动器：工作目录必须是本工程，避免误伤复用了同一 PID 的其他进程
_tf_pidfile_is_our_launcher() {
    local pid="$1"
    local cmd cwd

    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    _tf_is_protected_pid "$pid" && return 1
    ps -p "$pid" >/dev/null 2>&1 || return 1

    cmd="$(_tf_cmdline "$pid")"
    cwd="$(_tf_cwd "$pid")"
    [[ "$cwd" == "$PROJECT_ROOT" ]] || return 1
    [[ "$cmd" == *"npm"* || "$cmd" == *"next"* ]] || return 1
    return 0
}

_tf_descendants() {
    local pid="$1"
    local child
    for child in $(ps -o pid= --ppid "$pid" 2>/dev/null); do
        _tf_descendants "$child"
        echo "$child"
    done
}

this_frontend_collect_pids() {
    local -A seen=()
    local pid child root

    if [[ -f "$THIS_FRONTEND_PID_FILE" ]]; then
        root="$(tr -d '[:space:]' < "$THIS_FRONTEND_PID_FILE")"
        if _tf_pidfile_is_our_launcher "$root" || this_frontend_owns_pid "$root"; then
            seen["$root"]=1
            while IFS= read -r child; do
                [[ -z "$child" ]] && continue
                _tf_is_protected_pid "$child" && continue
                seen["$child"]=1
            done < <(_tf_descendants "$root")
        fi
    fi

    for pid in $(ps -eo pid= 2>/dev/null); do
        if this_frontend_owns_pid "$pid"; then
            seen["$pid"]=1
        fi
    done

    for pid in "${!seen[@]}"; do
        echo "$pid"
    done
}

this_frontend_port_pids() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true
        return
    fi
    if command -v ss >/dev/null 2>&1; then
        ss -lptn "sport = :${port}" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u
        return
    fi
    if command -v fuser >/dev/null 2>&1; then
        fuser "${port}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true
    fi
}

# 打印占用本工程端口、但不是本工程前端的 PID。有输出则调用方应中止，且不得 kill。
this_frontend_foreign_port_pids() {
    local pid
    while IFS= read -r pid; do
        [[ -z "$pid" ]] && continue
        if this_frontend_owns_pid "$pid"; then
            continue
        fi
        if _tf_pidfile_is_our_launcher "$pid"; then
            continue
        fi
        echo "$pid"
    done < <(this_frontend_port_pids "$THIS_FRONTEND_PORT")
}

this_frontend_stop() {
    local -a pids=()
    local pid cmd

    while IFS= read -r pid; do
        [[ -n "$pid" ]] && pids+=("$pid")
    done < <(this_frontend_collect_pids | sort -u)

    if [[ ${#pids[@]} -eq 0 ]]; then
        echo "没有发现本工程前端进程（${PROJECT_ROOT}）"
        rm -f "$THIS_FRONTEND_PID_FILE"
        return 0
    fi

    echo "只停止本工程前端，不影响其他应用："
    for pid in "${pids[@]}"; do
        cmd="$(_tf_cmdline "$pid")"
        echo "  PID ${pid}: ${cmd:0:160}"
    done

    kill -TERM "${pids[@]}" 2>/dev/null || true
    sleep 1

    local -a still=()
    for pid in "${pids[@]}"; do
        if ps -p "$pid" >/dev/null 2>&1; then
            still+=("$pid")
        fi
    done
    if [[ ${#still[@]} -gt 0 ]]; then
        kill -KILL "${still[@]}" 2>/dev/null || true
        sleep 1
    fi

    rm -f "$THIS_FRONTEND_PID_FILE"
}

# 0 = 端口可用或只被本工程占用；1 = 被其他应用占用（未结束对方）
this_frontend_assert_port_available() {
    local -a foreign=()
    local pid cmd

    while IFS= read -r pid; do
        [[ -n "$pid" ]] && foreign+=("$pid")
    done < <(this_frontend_foreign_port_pids | sort -u)

    if [[ ${#foreign[@]} -eq 0 ]]; then
        return 0
    fi

    echo "端口 ${THIS_FRONTEND_PORT} 被其他应用占用，已中止。这些进程没有被结束：" >&2
    for pid in "${foreign[@]}"; do
        cmd="$(_tf_cmdline "$pid")"
        echo "  PID ${pid}: ${cmd:0:160}" >&2
    done
    return 1
}
