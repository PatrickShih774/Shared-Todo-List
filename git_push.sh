cd /home/bg5blh/claudeProject/Todo_claude
git add .gitignore README.md package.json package-lock.json server.js db/ routes/ socket/ public/
echo "=== staged ==="
git status --short
echo "=== committing ==="
git commit -m "init: Shared Todo List - 多人共享四象限待办清单"
echo "=== pushing ==="
git push -u origin main 2>&1 || git push -u origin master 2>&1
