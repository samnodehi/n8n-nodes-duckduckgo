# 🛠️ Troubleshooting Guide

## ❌ Error: "Cannot read properties of null (reading '1')"

### 🔍 **What this error means:**
This error occurs when regex operations try to access array indices from null results. This was a known issue in versions prior to v24.6.25.

### ✅ **Solution:**

#### **For n8n Cloud Users:**
1. Go to **Settings** → **Community Nodes** 
2. **Uninstall** the existing DuckDuckGo node
3. **Reinstall** with the new package name: `n8n-nodes-duckduckgo-search@24.6.25`

#### **For n8n Self-Hosted:**
```bash
# 1. Stop n8n
docker stop n8n

# 2. Remove old node (if installed)
npm uninstall n8n-nodes-duckduckgo

# 3. Install the latest version
npm install n8n-nodes-duckduckgo-search@24.6.25

# 4. Restart n8n
docker start n8n
```

#### **For n8n Desktop:**
1. Open **Settings** → **Community Nodes**
2. Remove the existing DuckDuckGo node
3. Add new node: `n8n-nodes-duckduckgo-search@24.6.25`
4. Restart n8n

### 🎯 **Verification:**
After updating, you should see:
- ✅ Version `24.6.25` in the node
- ✅ Official DuckDuckGo icon (duck logo)
- ✅ No more null pointer errors
- ✅ Proper error handling with descriptive messages

### 🔧 **If the error persists:**

1. **Clear n8n cache:**
   ```bash
   # For Docker
   docker exec n8n rm -rf /home/node/.cache/n8n
   
   # For npm installation
   rm -rf ~/.cache/n8n
   ```

2. **Check node version:**
   - Look for version `24.6.25` in the node properties
   - Verify the DuckDuckGo icon is the official duck logo

3. **Enable Debug Mode:**
   - Set `Debug Mode` to `true` in the node
   - Check the logs for detailed error information

### 📞 **Still need help?**
- Create an issue: https://github.com/samnodehi/n8n-nodes-duckduckgo/issues
- Include your n8n version, node version, and the full error message

---

## 🎉 **Version 24.6.25 Features:**
- ✅ **Fixed:** Null pointer errors in regex operations
- ✅ **Added:** Official DuckDuckGo icon
- ✅ **Improved:** Error handling and debugging
- ✅ **Enhanced:** Test coverage (113 tests passing) 