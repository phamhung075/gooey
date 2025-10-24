#!/bin/bash

# NPM to PNPM Migration Script
# This script cleans all npm installations and migrates to pnpm

echo "================================================"
echo "NPM to PNPM Migration & Cleanup Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean npm cache on both Windows and WSL
echo -e "${YELLOW}Step 1: Cleaning npm cache...${NC}"
echo "Cleaning WSL npm cache..."
npm cache clean --force 2>/dev/null || echo "WSL npm cache already clean"

echo "Cleaning Windows npm cache..."
rm -rf /mnt/c/Users/daihu/AppData/Local/npm-cache/* 2>/dev/null
rm -rf /mnt/c/Users/daihu/AppData/Roaming/npm-cache/* 2>/dev/null
echo -e "${GREEN}✓ npm cache cleaned${NC}"
echo ""

# Step 2: Setup pnpm centralized store
echo -e "${YELLOW}Step 2: Setting up pnpm centralized store...${NC}"

# Configure pnpm for WSL
pnpm config set store-dir ~/.local/share/pnpm/store
echo "WSL pnpm store: ~/.local/share/pnpm/store"

# Configure pnpm for Windows (if running from Windows)
echo "Windows pnpm store will be at: C:\Users\daihu\AppData\Local\pnpm-store"
echo -e "${GREEN}✓ pnpm store configured${NC}"
echo ""

# Step 3: Find and count node_modules
echo -e "${YELLOW}Step 3: Finding all node_modules folders...${NC}"

# Count in WSL projects
WSL_COUNT=$(find /home/daihungpham/__projects__ -type d -name "node_modules" 2>/dev/null | wc -l)
echo "Found $WSL_COUNT node_modules folders in WSL projects"

# Estimate size
echo "Estimating total size (this may take a moment)..."
TOTAL_SIZE=$(du -sh /home/daihungpham/__projects__/*/node_modules 2>/dev/null | awk '{sum+=$1} END {print sum/1024 " GB"}' || echo "Unable to calculate")
echo "Estimated size: ~$TOTAL_SIZE"
echo ""

# Step 4: Create cleanup function
cleanup_node_modules() {
    local path="$1"
    echo -e "${YELLOW}Cleaning node_modules in: $path${NC}"

    # Find all node_modules directories and delete them
    find "$path" -type d -name "node_modules" -prune -exec rm -rf {} \; 2>/dev/null

    # Also clean package-lock.json files (we'll use pnpm-lock.yaml instead)
    find "$path" -name "package-lock.json" -delete 2>/dev/null
}

# Step 5: Ask for confirmation
echo -e "${RED}WARNING: This will delete ALL node_modules folders!${NC}"
echo "This will free up significant disk space but you'll need to reinstall dependencies with pnpm."
echo ""
read -p "Do you want to proceed with cleanup? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting cleanup...${NC}"

    # Clean WSL projects
    echo "Cleaning WSL project folders..."
    cleanup_node_modules "/home/daihungpham/__projects__"

    # Clean Windows folders (if accessible)
    echo "Cleaning Windows folders (this may take time)..."
    if [ -d "/mnt/c/Users/daihu" ]; then
        # Target specific development directories to avoid timeout
        for dir in "/mnt/c/Users/daihu/Documents" "/mnt/c/Users/daihu/Desktop"; do
            if [ -d "$dir" ]; then
                echo "Checking $dir..."
                cleanup_node_modules "$dir"
            fi
        done
    fi

    echo -e "${GREEN}✓ Cleanup completed!${NC}"
    echo ""

    # Step 6: Create helper script for migration
    cat > ~/migrate-to-pnpm.sh << 'EOF'
#!/bin/bash
# Helper script to migrate a project to pnpm

if [ ! -f "package.json" ]; then
    echo "Error: package.json not found in current directory"
    exit 1
fi

echo "Migrating current project to pnpm..."

# Remove old lock files
rm -f package-lock.json yarn.lock

# Install with pnpm
pnpm install

echo "✓ Migration complete! Use 'pnpm' instead of 'npm' from now on."
echo "Common commands:"
echo "  pnpm install     (instead of npm install)"
echo "  pnpm add <pkg>   (instead of npm install <pkg>)"
echo "  pnpm run <script> (instead of npm run <script>)"
EOF
    chmod +x ~/migrate-to-pnpm.sh

    echo -e "${GREEN}✓ Created migration helper script: ~/migrate-to-pnpm.sh${NC}"
    echo ""
    echo "========================================="
    echo "Migration Summary:"
    echo "========================================="
    echo "1. ✓ npm cache cleaned"
    echo "2. ✓ pnpm store configured"
    echo "3. ✓ All node_modules deleted"
    echo "4. ✓ Migration helper created"
    echo ""
    echo "Next steps:"
    echo "1. Go to any project directory"
    echo "2. Run: ~/migrate-to-pnpm.sh"
    echo "3. Or manually run: pnpm install"
    echo ""
    echo "pnpm benefits:"
    echo "- Saves 50-70% disk space with centralized store"
    echo "- Faster installations"
    echo "- Stricter dependency management"
    echo ""
else
    echo "Cleanup cancelled."
fi

# Step 7: Show disk space saved
echo -e "${YELLOW}Checking disk space...${NC}"
df -h /home/daihungpham
echo ""
echo "Script complete!"