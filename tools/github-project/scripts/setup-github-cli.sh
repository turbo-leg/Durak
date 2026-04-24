#!/bin/bash

# GitHub Integration Quick Setup Script for Durak

echo "🎮 Durak GitHub Integration Setup"
echo "=================================="
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Installing..."
    brew install gh
fi

# Check if authenticated
if gh auth status &> /dev/null; then
    echo "✅ Already authenticated with GitHub"
    gh auth status
else
    echo "🔐 Authenticating with GitHub..."
    gh auth login
fi

echo ""
echo "📋 Your Durak Issues:"
echo "===================="
gh issue list --repo turbo-leg/Durak --limit 10

echo ""
echo "🔀 Your Open Pull Requests:"
echo "=========================="
gh pr list --repo turbo-leg/Durak --limit 10

echo ""
echo "✨ Setup Complete!"
echo "Next: Run 'gh issue develop ISSUE_NUMBER' to start working on an issue"
