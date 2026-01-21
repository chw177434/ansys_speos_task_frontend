#!/bin/bash
# 恢复 .env 文件并修复编码

cd ~/code/ansys_speos_task_backend

# 1. 备份当前文件（如果存在）
if [ -f .env ]; then
    cp .env .env.backup.before_restore
    echo "✅ 已备份当前 .env 文件"
fi

# 2. 从备份文件恢复内容
if [ -f .env.backup.20260115_1437 ]; then
    # 使用 cat 读取并写入，确保 UTF-8 编码
    cat > .env << 'ENVEOF'
# # # ### dev
# REDIS_URL=redis://localhost:6379/0
# CELERY_BACKEND=redis://localhost:6379/1

# BASE_DIR=D:/mnt/speos_tasks
# INPUT_DIR=D:/mnt/speos_tasks/inputs
# OUTPUT_DIR=D:/mnt/speos_tasks/outputs
# LOGS_DIR=D:/mnt/speos_tasks/logs
# TMP_DIR=D:/mnt/speos_tasks/tmp

# CORS_ORIGINS=http://localhost:3000

# DEBUG_MODE=1

# SPEOS_CMD="C:/Program Files/ANSYS Inc/v252/Optical Products/Viewers/SPEOSCore.exe"
# SPEOS_BASE_ARGS=-C
# SPEOS_THREADS=16
# SPEOS_SESSION=0
# SPEOS_EXTRA_ARGS=
# SPEOS_TIMEOUT=
# SPEOS_XMP_ARCHIVE=xmp_results.zip

# CALLBACK_URL=


## build
REDIS_URL=redis://localhost:6379/0
CELERY_BACKEND=redis://localhost:6379/1

BASE_DIR=C:/speos-tools/speos-tasks
INPUT_DIR=C:/speos-tools/speos-tasks/inputs
OUTPUT_DIR=C:/speos-tools/speos-tasks/outputs
LOGS_DIR=C:/speos-tools/speos-tasks/logs
TMP_DIR=C:/speos-tools/speos-tasks/tmp

CORS_ORIGINS=http://localhost:3000

DEBUG_MODE=0

SPEOS_CMD=speoshpc
SPEOS_BASE_ARGS=
SPEOS_THREADS=
SPEOS_SESSION=0
SPEOS_EXTRA_ARGS=
SPEOS_TIMEOUT=
SPEOS_XMP_ARCHIVE=xmp_results.zip

CALLBACK_URL=
ENVEOF
    
    echo "✅ 已从备份文件恢复内容"
else
    echo "❌ 备份文件不存在: .env.backup.20260115_1437"
    exit 1
fi

# 3. 验证文件
echo ""
echo "📋 验证文件..."
file .env

# 4. 测试 UTF-8 读取
python3 << 'PYEOF'
try:
    with open('.env', 'r', encoding='utf-8') as f:
        content = f.read()
    print("✅ UTF-8 读取测试通过")
    print(f"   - 文件大小: {len(content)} 字符")
    print(f"   - 行数: {len(content.splitlines())}")
    
    # 测试 dotenv
    try:
        from dotenv import load_dotenv
        load_dotenv('.env')
        print("✅ dotenv 加载测试通过")
    except ImportError:
        print("⚠️  python-dotenv 未安装，跳过测试")
    except Exception as e:
        print(f"⚠️  dotenv 测试失败: {e}")
        
except Exception as e:
    print(f"❌ 验证失败: {e}")
    exit(1)
PYEOF

echo ""
echo "✅ 恢复完成！"
echo ""
echo "📝 下一步："
echo "  1. 检查 .env 文件内容是否正确"
echo "  2. 根据需要调整配置值"
echo "  3. 重启后端服务"
