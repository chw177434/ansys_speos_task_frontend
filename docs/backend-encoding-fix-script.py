#!/usr/bin/env python3
"""
修复 .env 文件编码和格式问题
适用于：编码错误、缺少换行符等问题
"""
import os
import sys
import shutil
import chardet

def fix_env_file(env_file='.env'):
    """修复 .env 文件编码和格式问题"""
    if not os.path.exists(env_file):
        print(f"❌ 文件不存在: {env_file}")
        return False
    
    # 备份
    backup_file = f"{env_file}.backup.auto"
    shutil.copy(env_file, backup_file)
    print(f"✅ 已备份到: {backup_file}")
    
    # 读取原始文件（二进制模式）
    with open(env_file, 'rb') as f:
        raw_data = f.read()
    
    print(f"📋 文件信息:")
    print(f"  - 大小: {len(raw_data)} 字节")
    print(f"  - 是否包含换行符: {'是' if b'\\n' in raw_data or b'\\r' in raw_data else '否'}")
    
    # 检测编码
    result = chardet.detect(raw_data)
    detected_encoding = result['encoding']
    confidence = result['confidence']
    
    print(f"\n📋 编码检测结果:")
    print(f"  - 检测到的编码: {detected_encoding}")
    print(f"  - 置信度: {confidence:.2%}")
    
    # 尝试的编码列表（按优先级）
    if detected_encoding and confidence > 0.7:
        encodings = [detected_encoding, 'utf-8', 'latin-1', 'gbk', 'gb2312', 'cp1252']
    else:
        # 如果检测不准确，尝试常见编码
        encodings = ['utf-8', 'latin-1', 'gbk', 'gb2312', 'cp1252', 'ascii']
    
    # 尝试解码
    text = None
    used_encoding = None
    decode_errors = []
    
    for encoding in encodings:
        if not encoding:
            continue
        try:
            text = raw_data.decode(encoding)
            used_encoding = encoding
            print(f"\n✅ 成功使用编码: {encoding}")
            break
        except UnicodeDecodeError as e:
            decode_errors.append(f"  - {encoding}: {e}")
            continue
    
    if text is None:
        print("\n❌ 无法使用任何编码解码文件")
        print("尝试的错误:")
        for err in decode_errors[:5]:  # 只显示前5个
            print(err)
        print("\n💡 建议:")
        print("  1. 检查文件是否损坏")
        print("  2. 尝试手动编辑文件")
        print("  3. 从 .env.example 重新创建")
        return False
    
    # 修复换行符问题
    # 如果文件没有换行符，尝试按常见分隔符分割
    if '\n' not in text and '\r' not in text:
        print("\n⚠️  文件没有换行符，尝试修复...")
        # 尝试按 NULL 字节分割（某些编辑器可能使用）
        if '\x00' in text:
            lines = text.split('\x00')
            text = '\n'.join(line.strip() for line in lines if line.strip())
            print("  - 使用 NULL 字节作为分隔符")
        else:
            # 如果文件很小，可能是单行，添加换行符
            if len(text) < 1000:
                text = text + '\n'
                print("  - 添加换行符")
            else:
                print("  - 警告：文件较大且没有换行符，可能需要手动检查")
    
    # 标准化换行符（统一为 \n）
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # 清理：移除末尾的多个空行
    text = text.rstrip() + '\n'
    
    # 验证内容
    print(f"\n📋 修复后的文件信息:")
    print(f"  - 行数: {len(text.splitlines())}")
    print(f"  - 字符数: {len(text)}")
    print(f"  - 包含换行符: {'是' if '\\n' in text else '否'}")
    
    # 显示前几行（用于验证）
    lines = text.splitlines()
    if lines:
        print(f"\n📋 文件内容预览（前3行）:")
        for i, line in enumerate(lines[:3], 1):
            # 隐藏敏感信息
            if '=' in line:
                key, _ = line.split('=', 1)
                print(f"  {i}. {key.strip()}=***")
            else:
                print(f"  {i}. {line[:50]}...")
    
    # 写入 UTF-8 编码的文件
    try:
        with open(env_file, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
        print(f"\n✅ 文件已修复并保存为 UTF-8 编码")
    except Exception as e:
        print(f"\n❌ 写入文件失败: {e}")
        return False
    
    # 验证修复后的文件
    print(f"\n🔍 验证修复结果...")
    try:
        # 测试 UTF-8 读取
        with open(env_file, 'r', encoding='utf-8') as f:
            test_content = f.read()
        print("✅ UTF-8 读取测试通过")
        
        # 测试 dotenv 是否可以读取（如果安装了 python-dotenv）
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            print("✅ dotenv 加载测试通过")
        except ImportError:
            print("⚠️  python-dotenv 未安装，跳过 dotenv 测试")
        except Exception as e:
            print(f"⚠️  dotenv 测试失败: {e}")
            print("   但文件编码应该是正确的，可能是内容问题")
        
        return True
    except Exception as e:
        print(f"❌ 验证失败: {e}")
        # 恢复备份
        shutil.copy(backup_file, env_file)
        print(f"🔄 已恢复备份文件")
        return False

def main():
    """主函数"""
    env_file = sys.argv[1] if len(sys.argv) > 1 else '.env'
    
    print("=" * 60)
    print("🔧 .env 文件编码修复工具")
    print("=" * 60)
    print(f"\n目标文件: {env_file}")
    
    if not os.path.exists(env_file):
        print(f"\n❌ 文件不存在: {env_file}")
        print("\n💡 提示:")
        print(f"  - 检查文件路径是否正确")
        print(f"  - 如果文件在其他位置，请指定完整路径")
        print(f"  - 示例: python3 {sys.argv[0]} /path/to/.env")
        sys.exit(1)
    
    success = fix_env_file(env_file)
    
    print("\n" + "=" * 60)
    if success:
        print("✅ 修复完成！")
        print("\n📝 下一步:")
        print("  1. 检查修复后的文件内容是否正确")
        print("  2. 重启后端服务")
        print("  3. 如果还有问题，检查是否有其他配置文件")
    else:
        print("❌ 修复失败")
        print("\n💡 建议:")
        print("  1. 检查备份文件: .env.backup.auto")
        print("  2. 尝试手动编辑文件")
        print("  3. 从 .env.example 重新创建")
    print("=" * 60)
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
