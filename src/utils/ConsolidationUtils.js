// ConsolidationUtils.js - Add to src/utils directory

/**
 * Utility functions for repository consolidation
 */

/**
 * Process selected items for consolidation
 * @param {Object} octokit - Octokit instance
 * @param {Array} sourceRepos - Array of source repositories
 * @param {Object} selectedItems - Object mapping repo IDs to selected items
 * @param {Object} targetPaths - Object mapping repo IDs to target paths
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Array>} - Array of processed items ready for commit
 */
export const processSelectedItems = async (
  octokit,
  sourceRepos,
  selectedItems,
  targetPaths,
  onProgress = () => {}
) => {
  const processedItems = [];
  let totalItems = 0;
  let processedCount = 0;
  
  // Count total items to process
  sourceRepos.forEach(repo => {
    const items = selectedItems[repo.id] || [];
    totalItems += items.length;
  });
  
  // Process each repository
  for (const repo of sourceRepos) {
    const items = selectedItems[repo.id] || [];
    const targetPath = targetPaths[repo.id] || '';
    
    onProgress(
      Math.round((processedCount / Math.max(totalItems, 1)) * 100),
      `Processing items from ${repo.name}...`
    );
    
    // Process each item
    for (const item of items) {
      try {
        if (item.type === 'file') {
          // Get file content
          const fileData = await getFileContent(octokit, repo.owner.login, repo.name, item.path);
          
          // Create target path
          const fileName = item.path.split('/').pop();
          const fullTargetPath = targetPath ? `${targetPath}/${fileName}` : fileName;
          
          processedItems.push({
            type: 'file',
            name: fileName,
            path: fullTargetPath,
            content: fileData.content,
            encoding: fileData.encoding,
            size: fileData.size,
            sourceRepo: repo.full_name
          });
        } else if (item.type === 'dir') {
          // For directories, recursively get all files
          const dirContents = await getRepositoryTree(
            octokit,
            repo.owner.login,
            repo.name,
            'main', // Default to main branch
            item.path
          );
          
          // Filter for files only
          const dirFiles = dirContents.filter(entry => 
            entry.type === 'blob' && 
            entry.path.startsWith(item.path)
          );
          
          // Process each file in the directory
          for (const file of dirFiles) {
            const fileData = await getFileContent(octokit, repo.owner.login, repo.name, file.path);
            
            // Create target path - maintain directory structure relative to selected dir
            const relativePath = file.path.substring(item.path.length);
            const fullTargetPath = targetPath 
              ? `${targetPath}${relativePath}` 
              : file.path.split('/').pop();
            
            processedItems.push({
              type: 'file',
              name: file.path.split('/').pop(),
              path: fullTargetPath,
              content: fileData.content,
              encoding: fileData.encoding,
              size: fileData.size,
              sourceRepo: repo.full_name
            });
          }
        }
        
        processedCount++;
        onProgress(
          Math.round((processedCount / Math.max(totalItems, 1)) * 100),
          `Processed ${processedCount} of ${totalItems} items...`
        );
      } catch (error) {
        console.error(`Error processing ${item.path} from ${repo.full_name}:`, error);
        throw new Error(`Failed to process ${item.path} from ${repo.full_name}: ${error.message}`);
      }
    }
  }
  
  return processedItems;
};

/**
 * Get file content from a repository
 * @param {Object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @returns {Promise<Object>} - File data
 */
export const getFileContent = async (octokit, owner, repo, path) => {
  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path
    });
    
    if (fileData.encoding === 'base64') {
      return {
        content: fileData.content,
        encoding: fileData.encoding,
        size: fileData.size,
        name: fileData.name
      };
    }
    
    throw new Error('Unsupported file encoding');
  } catch (error) {
    // Handle large files that need to be fetched via the Git Data API
    if (error.status === 403 && error.message.includes('too_large')) {
      // Get the file's blob SHA
      const { data: contents } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        headers: {
          accept: 'application/vnd.github.v3+json'
        }
      });
      
      // Get the blob content
      const { data: blob } = await octokit.git.getBlob({
        owner,
        repo,
        file_sha: contents.sha
      });
      
      return {
        content: blob.content,
        encoding: blob.encoding,
        size: blob.size,
        name: path.split('/').pop()
      };
    }
    
    throw error;
  }
};

/**
 * Get repository tree (all files and directories)
 * @param {Object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} path - Optional path filter
 * @returns {Promise<Array>} - Repository tree
 */
export const getRepositoryTree = async (octokit, owner, repo, branch = 'main', path = '') => {
  try {
    // Get the latest commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    const commitSha = refData.object.sha;
    
    // Get the tree SHA from the commit
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: commitSha
    });
    const treeSha = commitData.tree.sha;
    
    // Get the full tree recursively
    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: 1
    });
    
    // Filter by path if provided
    if (path) {
      return treeData.tree.filter(item => item.path.startsWith(path));
    }
    
    return treeData.tree;
  } catch (error) {
    console.error('Error getting repository tree:', error);
    throw new Error(`Failed to get repository tree: ${error.message}`);
  }
};

/**
 * Create consolidated commit in target repository
 * @param {Object} octokit - Octokit instance
 * @param {Object} targetRepo - Target repository
 * @param {Array} processedItems - Processed items to commit
 * @param {string} commitMessage - Commit message
 * @param {string} branch - Target branch
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} - Commit result
 */
export const createConsolidatedCommit = async (
  octokit,
  targetRepo,
  processedItems,
  commitMessage,
  branch = 'main',
  onProgress = () => {}
) => {
  try {
    onProgress(0, 'Preparing commit...');
    
    // Get latest commit and tree SHA
    const { data: refData } = await octokit.git.getRef({
      owner: targetRepo.owner.login,
      repo: targetRepo.name,
      ref: `heads/${branch}`
    });
    const latestCommitSha = refData.object.sha;
    
    const { data: commitData } = await octokit.git.getCommit({
      owner: targetRepo.owner.login,
      repo: targetRepo.name,
      commit_sha: latestCommitSha
    });
    const baseTreeSha = commitData.tree.sha;
    
    onProgress(10, 'Creating blobs...');
    
    // Create blobs for all files in batches
    const BATCH_SIZE = 10;
    const fileBlobs = [];
    
    for (let i = 0; i < processedItems.length; i += BATCH_SIZE) {
      const batch = processedItems.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (item) => {
        if (item.type === 'file') {
          try {
            const { data: blobData } = await octokit.git.createBlob({
              owner: targetRepo.owner.login,
              repo: targetRepo.name,
              content: item.content,
              encoding: item.encoding
            });
            
            return {
              path: item.path,
              mode: '100644', // Regular file
              type: 'blob',
              sha: blobData.sha
            };
          } catch (error) {
            console.error(`Error creating blob for ${item.path}:`, error);
            throw new Error(`Failed to create blob for ${item.path}: ${error.message}`);
          }
        }
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      fileBlobs.push(...batchResults.filter(Boolean));
      
      // Update progress
      const progress = 10 + Math.round((i / processedItems.length) * 40);
      onProgress(progress, `Created ${fileBlobs.length} of ${processedItems.length} blobs...`);
    }
    
    onProgress(50, 'Creating tree...');
    
    // Create tree with all files
    const { data: treeData } = await octokit.git.createTree({
      owner: targetRepo.owner.login,
      repo: targetRepo.name,
      base_tree: baseTreeSha,
      tree: fileBlobs
    });
    
    onProgress(70, 'Creating commit...');
    
    // Create commit
    const { data: newCommitData } = await octokit.git.createCommit({
      owner: targetRepo.owner.login,
      repo: targetRepo.name,
      message: commitMessage,
      tree: treeData.sha,
      parents: [latestCommitSha]
    });
    
    onProgress(90, 'Updating branch reference...');
    
    // Update branch reference
    await octokit.git.updateRef({
      owner: targetRepo.owner.login,
      repo: targetRepo.name,
      ref: `heads/${branch}`,
      sha: newCommitData.sha
    });
    
    onProgress(100, 'Consolidation complete!');
    
    return {
      success: true,
      commitSha: newCommitData.sha,
      message: `Successfully consolidated ${processedItems.length} items into ${targetRepo.full_name}`
    };
  } catch (error) {
    console.error('Error creating consolidated commit:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check for path conflicts in target repository
 * @param {Object} octokit - Octokit instance
 * @param {Object} targetRepo - Target repository
 * @param {Array} processedItems - Processed items to check
 * @param {string} branch - Target branch
 * @returns {Promise<Array>} - Array of conflicting paths
 */
export const checkPathConflicts = async (octokit, targetRepo, processedItems, branch = 'main') => {
  try {
    // Get all files in target repository
    const tree = await getRepositoryTree(
      octokit,
      targetRepo.owner.login,
      targetRepo.name,
      branch
    );
    
    // Check for conflicts
    const conflicts = [];
    
    for (const item of processedItems) {
      const existingFile = tree.find(file => file.path === item.path);
      
      if (existingFile) {
        conflicts.push({
          path: item.path,
          sourceRepo: item.sourceRepo,
          type: item.type
        });
      }
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error checking path conflicts:', error);
    throw new Error(`Failed to check path conflicts: ${error.message}`);
  }
};

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} - Operation result
 */
export const retryOperation = async (
  operation,
  { 
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry = () => {}
  } = {}
) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (error.status === 403 && error.headers && error.headers['x-ratelimit-remaining'] === '0') {
        const resetTime = parseInt(error.headers['x-ratelimit-reset']) * 1000;
        const waitTime = resetTime - Date.now() + 1000; // Add 1s buffer
        
        if (waitTime > 0 && waitTime < 60000) { // Only wait up to 1 minute
          await new Promise(resolve => setTimeout(resolve, waitTime));
          onRetry(attempt + 1, 'Rate limit exceeded, waiting for reset');
          continue;
        }
      }
      
      // Exponential backoff for network errors
      if (error.status >= 500 || error.code === 'ETIMEDOUT') {
        const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        onRetry(attempt + 1, 'Network error, retrying');
        continue;
      }
      
      // Don't retry other errors
      break;
    }
  }
  
  throw lastError;
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
