#!/bin/bash
# ============================================================
#  Travel Plan with Xiaomei — 一键部署脚本
#  用法: cd 到项目根目录，然后 bash deploy.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Travel Plan with Xiaomei — 一键部署脚本    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================
# 0. 检查前置条件
# ============================================================
echo -e "${YELLOW}[0/5] 检查前置条件...${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未找到 Node.js，请先安装 Node.js >= 18${NC}"
    exit 1
fi
echo -e "  ✅ Node.js $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未找到 npm${NC}"
    exit 1
fi
echo -e "  ✅ npm $(npm -v)"

# ============================================================
# 1. 推送代码到 GitHub
# ============================================================
echo ""
echo -e "${YELLOW}[1/5] 推送代码到 GitHub...${NC}"

cd "$PROJECT_DIR"

# 检查是否已有 git repo
if [ ! -d ".git" ]; then
    git init
    git config user.name "deploy"
    git config user.email "deploy@local"
fi

# 添加远程仓库（如果还没有）
REMOTE_URL="https://github.com/wjiacheng599-creator/meituan-ai-planner.git"
if ! git remote get-url origin &> /dev/null; then
    git remote add origin "$REMOTE_URL"
else
    git remote set-url origin "$REMOTE_URL"
fi

# 添加所有文件并提交
git add -A
if git diff --cached --quiet 2>/dev/null; then
    echo -e "  ℹ️  没有新的改动需要提交"
else
    git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')" || true
fi

# 推送
echo -e "  📤 推送到 $REMOTE_URL ..."
git push -u origin main 2>&1 || {
    echo -e "${YELLOW}  ⚠️  推送失败，可能需要认证。请手动运行:${NC}"
    echo -e "  ${BLUE}git push -u origin main${NC}"
    echo -e "  或配置 GitHub Personal Access Token:"
    echo -e "  ${BLUE}git remote set-url origin https://YOUR_TOKEN@github.com/wjiacheng599-creator/meituan-ai-planner.git${NC}"
}

echo -e "  ✅ 代码已就绪"

# ============================================================
# 2. 安装 CLI 工具
# ============================================================
echo ""
echo -e "${YELLOW}[2/5] 安装部署 CLI 工具...${NC}"

if ! command -v vercel &> /dev/null; then
    echo -e "  📦 安装 Vercel CLI..."
    npm install -g vercel@latest 2>&1 | tail -1
fi
echo -e "  ✅ Vercel CLI $(vercel --version 2>/dev/null || echo '已安装')"

if ! command -v railway &> /dev/null; then
    echo -e "  📦 安装 Railway CLI..."
    npm install -g railway 2>&1 | tail -1
fi
echo -e "  ✅ Railway CLI $(railway --version 2>/dev/null || echo '已安装')"

# ============================================================
# 3. 部署后端到 Railway
# ============================================================
echo ""
echo -e "${YELLOW}[3/5] 部署后端到 Railway...${NC}"
echo -e "  🔑 Railway 会打开浏览器让你登录，请完成登录后回到终端"
echo ""

cd "$PROJECT_DIR"

# 登录 Railway
railway login 2>&1 || true

# 创建项目并部署
echo -e "  🏗️  创建 Railway 项目..."
railway init --name meituan-ai-planner-api 2>&1 || true

# 设置环境变量
echo -e "  ⚙️  设置环境变量..."
echo -e "  ${YELLOW}请准备以下 API Key:${NC}"
echo -e "    - DASHSCOPE_API_KEY (阿里云 DashScope)"
echo -e "    - AMAP_KEY (高德地图 Web 服务 Key)"
echo -e ""

read -p "  请输入 DASHSCOPE_API_KEY: " DASHSCOPE_KEY
read -p "  请输入 AMAP_KEY (高德地图Web服务Key): " AMAP_KEY_VAL

railway variables set DASHSCOPE_API_KEY="$DASHSCOPE_KEY" 2>&1
railway variables set AMAP_KEY="$AMAP_KEY_VAL" 2>&1
railway variables set API_PORT=8788 2>&1
railway variables set NODE_ENV=production 2>&1
railway variables set COOKIE_SECRET="$(openssl rand -hex 32)" 2>&1

# 部署
echo -e "  🚀 部署中..."
railway up --service meituan-ai-planner-api 2>&1

# 获取部署 URL
echo -e "  ⏳ 等待部署完成..."
sleep 5
RAILWAY_URL=$(railway status 2>&1 | grep -oE 'https://[a-z0-9-]+\.up\.railway\.app' | head -1)

if [ -z "$RAILWAY_URL" ]; then
    echo -e "  ${YELLOW}⚠️  无法自动获取 Railway URL，请在 Railway 控制台查看${NC}"
    echo -e "  ${BLUE}https://railway.app/dashboard${NC}"
    read -p "  请输入你的 Railway 后端 URL (如 https://xxx.up.railway.app): " RAILWAY_URL
fi

echo -e "  ✅ 后端已部署: ${GREEN}$RAILWAY_URL${NC}"

# ============================================================
# 4. 部署前端到 Vercel
# ============================================================
echo ""
echo -e "${YELLOW}[4/5] 部署前端到 Vercel...${NC}"
echo -e "  🔑 Vercel 会打开浏览器让你登录，请完成登录后回到终端"
echo ""

cd "$PROJECT_DIR"

# 登录 Vercel
vercel login 2>&1 || true

# 设置环境变量文件（Vercel 使用 env 命令或 dashboard）
echo -e "  ⚙️  设置前端环境变量..."
echo -e "  ${YELLOW}请准备以下 Key:${NC}"
echo -e "    - VITE_AMAP_KEY (高德地图 JS API Key)"
echo -e "    - VITE_AMAP_JS_KEY (同上，高德 JS API Key)"
echo -e "    - VITE_AMAP_SECURITY_CODE (高德安全密钥)"
echo -e ""

read -p "  请输入 VITE_AMAP_KEY (高德JS API Key): " VITE_AMAP_KEY_VAL
read -p "  请输入 VITE_AMAP_JS_KEY (通常和上面一样): " VITE_AMAP_JS_KEY_VAL
read -p "  请输入 VITE_AMAP_SECURITY_CODE: " VITE_AMAP_SECURITY_CODE_VAL

# 使用 Vercel CLI 部署（带环境变量）
echo -e "  🚀 部署中..."
vercel --prod \
  -e VITE_API_BASE_URL="$RAILWAY_URL" \
  -e VITE_AMAP_KEY="$VITE_AMAP_KEY_VAL" \
  -e VITE_AMAP_JS_KEY="$VITE_AMAP_JS_KEY_VAL" \
  -e VITE_AMAP_SECURITY_CODE="$VITE_AMAP_SECURITY_CODE_VAL" \
  -e VITE_AMAP_USE_PROXY=true \
  -e VITE_AMAP_PROXY_HOST=/api/amap \
  -e VITE_AI_PROVIDER=dashscope \
  -e VITE_USE_REAL_AGENT=false \
  -e VITE_DEMO_MODE_FAST=true \
  --yes 2>&1

# 获取 Vercel URL
VERCEL_URL=$(vercel ls 2>&1 | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | head -1)

if [ -z "$VERCEL_URL" ]; then
    echo -e "  ${YELLOW}⚠️  无法自动获取 Vercel URL，请在 Vercel 控制台查看${NC}"
    echo -e "  ${BLUE}https://vercel.com/dashboard${NC}"
    read -p "  请输入你的 Vercel 前端 URL: " VERCEL_URL
fi

echo -e "  ✅ 前端已部署: ${GREEN}$VERCEL_URL${NC}"

# ============================================================
# 5. 验证部署
# ============================================================
echo ""
echo -e "${YELLOW}[5/5] 验证部署...${NC}"

# 检查后端健康
if [ -n "$RAILWAY_URL" ]; then
    HEALTH=$(curl -s "$RAILWAY_URL/api/health" 2>/dev/null)
    if echo "$HEALTH" | grep -q "ok\|healthy\|running"; then
        echo -e "  ✅ 后端健康检查通过"
    else
        echo -e "  ⚠️  后端健康检查返回: $HEALTH"
    fi
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            🎉 部署完成！                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  📱 前端地址: ${BLUE}$VERCEL_URL${NC}"
echo -e "  🔧 后端地址: ${BLUE}$RAILWAY_URL${NC}"
echo ""
echo -e "  ${YELLOW}注意事项:${NC}"
echo -e "  1. Railway 免费版会在无活动时休眠，首次访问需等待几秒"
echo -e "  2. 确保高德地图控制台已添加 ${VERCEL_URL} 到域名白名单"
echo -e "  3. 如需修改环境变量，在 Railway/Vercel 控制台操作"
echo ""
