
import React, { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import JSZip from 'jszip'; // Import JSZip
import {
  AppContainer,
  Header,
  Title,
  UserInfo,
  UserAvatar, // Added missing import
  UserName,
  LoginButton,
  LogoutButton,
  MainContent,
  Sidebar,
  SidebarHeader,
  RepoList,
  RepoItem,
  Content,
  RepositoryHeader,
  RepoName,
  BranchSelector,
  PathNavigator,
  PathItem,
  PathSeparator,
  FileExplorer,
  FileItem,
  FileIcon,
  FileName,
  DropZone,
  DropZoneText,
  WelcomeMessage,
  Notification,
  Modal,
  ModalContent,
  ModalHeader,
  CloseButton,
  ModalBody,
  FileList,
  FileListItem,
  CommitMessageInput, // Assuming this is a styled div/label wrapper
  ModalFooter,
  CancelButton,
  UploadButton
} from './styles/StyledComponents'; // Assuming this path is correct and file is .js/.jsx

// GitHub OAuth App credentials read from environment variables (if needed for OAuth flow)
// const GITHUB_CLIENT_ID = process.env.REACT_APP_GITHUB_CLIENT_ID;
// const GITHUB_CLIENT_SECRET = process.env.REACT_APP_GITHUB_CLIENT_SECRET;

const App = () => {
  // State variables
  const [authenticated, setAuthenticated] = useState(false);
  const [octokit, setOctokit] = useState(null);
  const [user, setUser] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [contents, setContents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState("");
  const [notification, setNotification] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState(""); // Target folder for uploads

  // New states for upload conflict handling
  const [uploadStep, setUploadStep] = useState("initial"); // 'initial', 'confirmConflict', 'uploading'
  const [detectedConflicts, setDetectedConflicts] = useState([]); // Array of { zipPath: string, repoPath: string }
  const [conflictResolution, setConflictResolution] = useState(null); // 'replace', 'skip'

  // Helper function to reset upload modal state
  const resetUploadState = () => {
    setUploadFiles([]);
    setCommitMessage("");
    setNewFolderName("");
    setUploadStep("initial");
    setDetectedConflicts([]);
    setConflictResolution(null);
    setShowUploadModal(false);
  };

  // Initialize GitHub on component mount
  useEffect(() => {
    const token = localStorage.getItem('github_token');
    if (token) {
      initializeGitHub(token);
    }
  }, []);

  // Initialize GitHub with token
  const initializeGitHub = async (token) => {
    try {
      const octokitInstance = new Octokit({ auth: token });
      setOctokit(octokitInstance);
      const { data: userData } = await octokitInstance.users.getAuthenticated();
      setUser(userData);
      setAuthenticated(true);
      await loadUserRepositories(octokitInstance);
      showNotification('success', `Logged in as ${userData.login}`);
    } catch (error) {
      console.error('Authentication error:', error);
      localStorage.removeItem('github_token');
      setAuthenticated(false);
      setUser(null);
      setOctokit(null);
      showNotification('error', 'Authentication failed. Please check your token.');
    }
  };

  // Load user repositories
  const loadUserRepositories = async (octokitInstance) => {
    try {
      const { data: repos } = await octokitInstance.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 100
      });
      const sortedRepos = [...repos].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setRepositories(sortedRepos);
    } catch (error) {
      console.error("Error loading repositories:", error);
      showNotification("error", "Failed to load repositories");
    }
  };

  // Load repository contents
  const loadRepositoryContents = async (repo, path = '', branch = 'main') => {
    if (!octokit || !repo) return false;
    try {
      setContents([]); // Clear previous contents
      const encodedPath = path ? path.replace(/^\//, '') : '';
      const { data: contentsData } = await octokit.repos.getContent({
        owner: repo.owner.login,
        repo: repo.name,
        path: encodedPath,
        ref: branch,
        headers: { 'If-None-Match': '' } // Prevent caching
      });
      setContents(Array.isArray(contentsData) ? contentsData : [contentsData]);
      setCurrentPath(path || '/');

      // Load branches
      const { data: branchesData } = await octokit.repos.listBranches({
        owner: repo.owner.login,
        repo: repo.name
      });
      setBranches(branchesData.map(b => b.name));
      setCurrentBranch(branch);
      return true;
    } catch (error) {
      console.error('Error loading repository contents:', error);
      // Handle 404 for empty repo/path gracefully
      if (error.status === 404) {
          setContents([]); // Set contents to empty array if path not found
          setCurrentPath(path || '/');
          showNotification('info', `Path '${path || '/'}' not found or is empty.`);
          // Still load branches if possible
          try {
              const { data: branchesData } = await octokit.repos.listBranches({ owner: repo.owner.login, repo: repo.name });
              setBranches(branchesData.map(b => b.name));
              setCurrentBranch(branch);
          } catch (branchError) {
              console.error('Error loading branches after 404:', branchError);
              showNotification('error', 'Failed to load branches.');
          }
          return true; // Indicate handled state
      } else {
          showNotification('error', 'Failed to load repository contents.');
          return false;
      }
    }
  };

  // Handle repository selection
  const handleSelectRepository = async (repo) => {
    setSelectedRepo(repo);
    setCurrentPath('/'); // Reset path on repo change
    await loadRepositoryContents(repo, '', 'main'); // Load root of main branch
  };

  // Handle branch selection
  const handleSelectBranch = async (event) => {
    const branch = event.target.value;
    if (selectedRepo) {
      await loadRepositoryContents(selectedRepo, currentPath, branch);
    }
  };

  // Handle directory/file navigation
  const handleNavigate = async (item) => {
    if (!selectedRepo) return;
    if (item.type === 'dir') {
      await loadRepositoryContents(selectedRepo, item.path, currentBranch);
    } else if (item.type === 'file') {
      // View file content (basic implementation)
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          path: item.path,
          ref: currentBranch
        });

        if (fileData.encoding === 'base64') {
          if (isImageFile(fileData.name)) {
            const imageUrl = `data:image/${fileData.name.split('.').pop()};base64,${fileData.content}`;
            // In a real app, open this in a modal or new tab
            console.log('Image URL:', imageUrl);
            showNotification('info', `Viewing image: ${item.name}`);
            window.open(imageUrl, '_blank'); // Simple preview
          } else {
            try {
                const content = atob(fileData.content);
                // Display in a modal or dedicated viewer
                console.log('File content:', content);
                showNotification('info', `Viewing file: ${item.name}. Content logged to console.`);
                alert(`File: ${item.name}\n\nContent:\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`); // Simple preview
            } catch (e) {
                console.error('Error decoding base64 content:', e);
                showNotification('error', `Could not decode content for ${item.name}. It might be binary.`);
            }
          }
        } else {
          // Handle non-base64 encoded content if necessary (e.g., submodule)
          console.log('File data (non-base64):', fileData);
          showNotification('info', `Viewing file info for: ${item.name}. Details logged to console.`);
        }
      } catch (error) {
        console.error('Error loading file content:', error);
        showNotification('error', 'Failed to load file content.');
      }
    }
  };

  // Navigate up the path
  const handlePathNavigation = (index) => {
      const pathSegments = currentPath.split('/').filter(Boolean);
      const newPath = '/' + pathSegments.slice(0, index + 1).join('/');
      if (selectedRepo) {
          loadRepositoryContents(selectedRepo, newPath, currentBranch);
      }
  };

  // Check if file is an image
  const isImageFile = (filename) => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!authenticated || !selectedRepo) {
      showNotification('error', 'Please select a repository first');
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setUploadFiles(files);
      setShowUploadModal(true);
      // Reset modal state explicitly when opening
      setUploadStep("initial");
      setDetectedConflicts([]);
      setConflictResolution(null);
      setNewFolderName(""); // Clear previous folder name
      setCommitMessage(""); // Clear previous commit message
    }
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // --- Refactored Upload Logic --- 

  // Step 1: Initiate Upload & Conflict Check
  const handleUploadInitiation = async () => {
    if (!newFolderName.trim()) {
      showNotification("error", "Please enter a folder name for the upload.");
      return;
    }
    if (!commitMessage.trim()) {
      showNotification("error", "Please enter a commit message.");
      return;
    }

    const containsZip = uploadFiles.some(file => file.name.toLowerCase().endsWith('.zip'));
    let rootFileNames = new Set();
    let conflicts = [];

    setUploadStep("uploading"); // Show processing state immediately
    showNotification("info", "Checking for potential file conflicts...");

    try {
      // Fetch root contents ONLY if a ZIP is present
      if (containsZip && selectedRepo && octokit) {
        try {
          const { data: rootContents } = await octokit.repos.getContent({
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            path: '', // Root path
            ref: currentBranch,
            headers: { 'If-None-Match': '' } // Prevent caching
          });
          if (Array.isArray(rootContents)) {
            rootContents.forEach(item => {
              if (item.type === 'file') {
                rootFileNames.add(item.name.toLowerCase()); // Use lowercase for comparison
              }
            });
          }
        } catch (error) {
          if (error.status === 404) {
            console.log("Repository root is empty or not found (404), proceeding without conflict check.");
          } else {
            console.error("Error fetching root contents:", error);
            showNotification("error", "Failed to check for root file conflicts. Proceeding without check.");
          }
        }
      }

      // Analyze ZIPs for conflicts (only if ZIP present and root files exist)
      if (containsZip && rootFileNames.size > 0) {
        const zip = new JSZip();
        for (const file of uploadFiles) {
          if (file.name.toLowerCase().endsWith(".zip")) {
            try {
              const zipData = await zip.loadAsync(file);
              const zipEntries = Object.values(zipData.files);
              for (const entry of zipEntries) {
                if (!entry.dir) {
                  const baseName = entry.name.split('/').pop();
                  const baseNameLower = baseName.toLowerCase();
                  if (rootFileNames.has(baseNameLower)) {
                    if (!conflicts.some(c => c.repoPath.toLowerCase() === baseNameLower)) {
                      conflicts.push({ zipPath: entry.name, repoPath: baseName }); // Store original case repoPath
                    }
                  }
                }
              }
            } catch (zipError) {
              console.error(`Error reading zip file ${file.name}:`, zipError);
              showNotification("error", `Could not read ${file.name}. Skipping conflict check for this file.`);
            }
          }
        }
        setDetectedConflicts(conflicts);
      }

      // Decide next step
      if (conflicts.length > 0) {
        setUploadStep("confirmConflict");
        showNotification("warning", "File conflicts detected. Please confirm resolution.");
      } else {
        showNotification("info", "No conflicts detected. Proceeding with upload...");
        await proceedWithUpload(null); // Pass null resolution
      }

    } catch (error) {
      console.error("Error during upload initiation/conflict check:", error);
      showNotification("error", `Conflict check failed: ${error.message}`);
      setUploadStep("initial"); // Revert step on error
    }
  };

  // Step 2: Handle User's Conflict Resolution Choice
  const handleConflictResolution = async (resolutionChoice) => {
    setConflictResolution(resolutionChoice); // Store the choice
    setUploadStep("uploading");
    showNotification("info", `Proceeding with resolution: ${resolutionChoice}. Uploading...`);
    await proceedWithUpload(resolutionChoice);
  };

  // Step 3: Process Files and Commit
  const proceedWithUpload = async (currentConflictResolution) => {
    if (!octokit || !selectedRepo) {
        showNotification("error", "Lost connection or repository context. Please retry.");
        resetUploadState();
        return;
    }

    showNotification("info", "Preparing upload... This may take a moment.");
    setUploadStep("uploading"); // Ensure step is uploading

    try {
      // Get latest commit and base tree SHA
      const { data: refData } = await octokit.git.getRef({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        ref: `heads/${currentBranch}`
      });
      const latestCommitSha = refData.object.sha;

      const { data: commitData } = await octokit.git.getCommit({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        commit_sha: latestCommitSha
      });
      const baseTreeSha = commitData.tree.sha;

      // Process files and create blobs
      const fileBlobs = [];
      const zip = new JSZip();

      showNotification("info", "Processing files and creating blobs...");

      for (const file of uploadFiles) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          // --- ZIP File Processing ---
          try {
            const zipData = await zip.loadAsync(file);
            const zipEntries = Object.values(zipData.files);
            for (const entry of zipEntries) {
              if (!entry.dir) {
                const entryBaseName = entry.name.split('/').pop();
                const conflictData = detectedConflicts.find(c => c.repoPath.toLowerCase() === entryBaseName.toLowerCase());
                let targetPath = "";
                let shouldSkip = false;

                if (conflictData) {
                  if (currentConflictResolution === 'replace') {
                    targetPath = conflictData.repoPath; // Replace root file
                    console.log(`Conflict: Replacing root file ${targetPath} with ${entry.name}`);
                  } else { // 'skip'
                    shouldSkip = true;
                    console.log(`Conflict: Skipping file ${entry.name} conflicting with root file ${conflictData.repoPath}`);
                  }
                } else {
                  // Not a conflict, place in the specified folder relative to currentPath
                  const basePath = currentPath === '/' ? newFolderName : `${currentPath.replace(/^\/|\/$/g, '')}/${newFolderName}`;
                  targetPath = `${basePath}/${entry.name}`;
                  console.log(`No conflict: Adding ${entry.name} to ${targetPath}`);
                }

                if (!shouldSkip) {
                  targetPath = targetPath.replace(/^\/+/g, ''); // Clean leading slashes
                  if (!targetPath) continue; // Avoid empty paths
                  const entryContent = await entry.async("base64");
                  const { data: blobData } = await octokit.git.createBlob({
                    owner: selectedRepo.owner.login,
                    repo: selectedRepo.name,
                    content: entryContent,
                    encoding: "base64"
                  });
                  fileBlobs.push({ path: targetPath, mode: "100644", type: "blob", sha: blobData.sha });
                }
              }
            }
          } catch (zipError) {
            console.error(`Error processing zip file ${file.name}:`, zipError);
            showNotification("error", `Failed to process ${file.name}. Skipping this file.`);
            continue;
          }
        } else {
          // --- Non-ZIP File Processing ---
          const basePath = currentPath === '/' ? newFolderName : `${currentPath.replace(/^\/|\/$/g, '')}/${newFolderName}`;
          const filePath = `${basePath}/${file.name}`;
          const cleanFilePath = filePath.replace(/^\/+/g, '');
          if (!cleanFilePath) continue; // Avoid empty paths
          console.log(`Adding non-ZIP file ${file.name} to ${cleanFilePath}`);
          const content = await readFileAsBase64(file);
          const { data: blobData } = await octokit.git.createBlob({
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            content: content,
            encoding: "base64"
          });
          fileBlobs.push({ path: cleanFilePath, mode: "100644", type: "blob", sha: blobData.sha });
        }
      }

      // Check if any blobs were actually created
      if (fileBlobs.length === 0) {
        showNotification("warning", "No files were processed for upload (possibly all skipped or empty).");
        resetUploadState();
        return;
      }

      showNotification("info", "Creating commit...");

      // Create Tree
      const { data: treeData } = await octokit.git.createTree({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        base_tree: baseTreeSha,
        tree: fileBlobs
      });

      // Create Commit
      const { data: newCommitData } = await octokit.git.createCommit({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        message: commitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha]
      });

      // Update Branch Reference
      await octokit.git.updateRef({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        ref: `heads/${currentBranch}`,
        sha: newCommitData.sha,
        force: false // Consider adding conflict handling for the ref update itself
      });

      showNotification("success", `Successfully uploaded files to ${newFolderName ? `folder '${newFolderName}'` : 'current directory'} and resolved conflicts.`);
      resetUploadState();

      // Refresh contents after a short delay
      setTimeout(() => {
        if (selectedRepo) {
            loadRepositoryContents(selectedRepo, currentPath, currentBranch);
        }
      }, 1000);

    } catch (error) {
      console.error("Error during file processing or commit:", error);
      if (error.status === 409) {
        showNotification("error", "Upload failed: Conflict detected during commit. Please refresh and try again.");
      } else if (error.status === 422 && error.message.includes("tree entry")) {
         showNotification("error", `Upload failed: Invalid file path detected. Check folder/file names. (${error.message})`);
      } else {
        showNotification("error", `Upload failed: ${error.message || 'Unknown error'}`);
      }
      setUploadStep("initial"); // Revert to initial step on commit failure
      // Keep modal open for user to retry or cancel
      // Consider *not* calling resetUploadState() here so user doesn't lose inputs
    }
  };

  // Read file as base64 (utility function)
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } catch (error) {
          reject(new Error('Error processing file data: ' + error.message));
        }
      };
      reader.onerror = (error) => reject(new Error('FileReader error: ' + error.message));
      reader.readAsDataURL(file);
      // Add a timeout? Maybe not necessary if browser handles it.
    });
  };

  // Show notification
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Handle login
  const handleLogin = () => {
    const token = prompt('Enter your GitHub Personal Access Token (with repo scope):');
    if (token) {
      localStorage.setItem('github_token', token);
      initializeGitHub(token);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('github_token');
    setAuthenticated(false);
    setUser(null);
    setOctokit(null);
    setRepositories([]);
    setSelectedRepo(null);
    setContents([]);
    setCurrentPath('/');
    setBranches([]);
    resetUploadState(); // Also clear upload state on logout
  };

  // --- Render Logic --- 

  return (
    <AppContainer>
      <Header>
        <Title>Git Helper Web</Title>
        {authenticated && user ? (
          <UserInfo>
            <UserAvatar src={user.avatar_url} alt={`${user.login} avatar`} />
            <UserName>{user.login}</UserName>
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </UserInfo>
        ) : (
          <LoginButton onClick={handleLogin}>Login with GitHub Token</LoginButton>
        )}
      </Header>

      <MainContent>
        {authenticated && (
          <Sidebar>
            <SidebarHeader>Repositories</SidebarHeader>
            <RepoList>
              {repositories.map(repo => (
                <RepoItem
                  key={repo.id}
                  selected={selectedRepo?.id === repo.id}
                  onClick={() => handleSelectRepository(repo)}
                >
                  {repo.name}
                </RepoItem>
              ))}
            </RepoList>
          </Sidebar>
        )}

        <Content onDragOver={handleDragOver} onDrop={handleDrop}>
          {!authenticated ? (
            <WelcomeMessage>
              <h2>Welcome to Git Helper Web</h2>
              <p>Please log in using a GitHub Personal Access Token with 'repo' scope to manage your repositories.</p>
              <LoginButton onClick={handleLogin}>Login with GitHub Token</LoginButton>
            </WelcomeMessage>
          ) : !selectedRepo ? (
            <WelcomeMessage>
              <h2>Select a Repository</h2>
              <p>Choose a repository from the sidebar to view its contents.</p>
            </WelcomeMessage>
          ) : (
            <>
              <RepositoryHeader>
                <RepoName>{selectedRepo.name}</RepoName>
                {branches.length > 0 && (
                  <BranchSelector>
                    <label htmlFor="branch-select">Branch:</label>
                    <select id="branch-select" value={currentBranch} onChange={handleSelectBranch}>
                      {branches.map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </BranchSelector>
                )}
              </RepositoryHeader>

              <PathNavigator>
                 <PathItem onClick={() => loadRepositoryContents(selectedRepo, '/', currentBranch)}>Root</PathItem>
                 {currentPath.split('/').filter(Boolean).map((segment, index, arr) => (
                     <React.Fragment key={index}>
                         <PathSeparator>/</PathSeparator>
                         <PathItem onClick={() => handlePathNavigation(index)}>
                             {segment}
                         </PathItem>
                     </React.Fragment>
                 ))}
              </PathNavigator>

              <FileExplorer>
                {contents.length === 0 && <p style={{ padding: '10px 16px', color: '#8b949e' }}>This directory is empty.</p>}
                {contents.sort((a, b) => {
                    // Sort directories first, then files, then alphabetically
                    if (a.type === 'dir' && b.type !== 'dir') return -1;
                    if (a.type !== 'dir' && b.type === 'dir') return 1;
                    return a.name.localeCompare(b.name);
                  }).map(item => (
                  <FileItem key={item.sha} onClick={() => handleNavigate(item)} title={`Type: ${item.type} | Size: ${item.size || 'N/A'}`}>
                    <FileIcon>{item.type === 'dir' ? '📁' : '📄'}</FileIcon>
                    <FileName>{item.name}</FileName>
                  </FileItem>
                ))}
              </FileExplorer>

              <DropZone>
                <DropZoneText>Drag & Drop files or ZIP archives here to upload to '{newFolderName || "<Specify Folder Name>"}' in '{currentPath}'</DropZoneText>
              </DropZone>
            </>
          )}
        </Content>
      </MainContent>

      {notification && (
        <Notification type={notification.type}>{notification.message}</Notification>
      )}

      {showUploadModal && (
        <Modal>
          <ModalContent>
            {/* Initial Upload Prompt */} 
            {uploadStep === "initial" && (
              <>
                <ModalHeader>
                  <h3>Upload Files to '{selectedRepo?.name}'</h3>
                  <CloseButton onClick={resetUploadState}>&times;</CloseButton>
                </ModalHeader>
                <ModalBody>
                  <p>Files to upload:</p>
                  <FileList>
                    {uploadFiles.map((file, index) => (
                      <FileListItem key={index}>{file.name} ({ (file.size / 1024).toFixed(2) } KB)</FileListItem>
                    ))}
                  </FileList>
                  <div style={{ marginBottom: '15px' }}> {/* Added margin */} 
                    <label htmlFor="newFolderName" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Target Folder Name:</label>
                    <input
                      type="text"
                      id="newFolderName"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Enter folder name (required)"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#f0f6fc' }}
                    />
                  </div>
                  <CommitMessageInput> {/* Assuming this provides label styling */} 
                    <label htmlFor="commitMessage" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Commit Message:</label>
                    <textarea
                      id="commitMessage"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Enter commit message (required)"
                      rows={3}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#f0f6fc', resize: 'vertical' }}
                    />
                  </CommitMessageInput>
                </ModalBody>
                <ModalFooter>
                  <CancelButton onClick={resetUploadState}>Cancel</CancelButton>
                  <UploadButton onClick={handleUploadInitiation} disabled={!newFolderName.trim() || !commitMessage.trim()}>Check & Upload</UploadButton>
                </ModalFooter>
              </>
            )}

            {/* Conflict Confirmation */} 
            {uploadStep === "confirmConflict" && (
              <>
                <ModalHeader>
                  <h3>File Conflict Detected</h3>
                  <CloseButton onClick={resetUploadState}>&times;</CloseButton>
                </ModalHeader>
                <ModalBody>
                  <p>The uploaded ZIP contains files that already exist in the repository's root directory:</p>
                  <FileList style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #30363d', borderRadius: '6px', padding: '5px' }}> {/* Added styling for list */} 
                    {detectedConflicts.map((conflict, index) => (
                      <FileListItem key={index} style={{ borderBottom: 'none', marginBottom: '2px' }}>
                        <strong>{conflict.repoPath}</strong> (from ZIP: {conflict.zipPath})
                      </FileListItem>
                    ))}
                  </FileList>
                  <p style={{ marginTop: '15px' }}>Do you want to replace these files in the root directory? Non-conflicting files will be added to the '<strong>{newFolderName}</strong>' folder.</p>
                </ModalBody>
                <ModalFooter>
                  <CancelButton onClick={resetUploadState}>Cancel Upload</CancelButton>
                  <CancelButton onClick={() => handleConflictResolution('skip')}>Skip Conflicting Files</CancelButton>
                  <UploadButton onClick={() => handleConflictResolution('replace')}>Replace Root Files</UploadButton>
                </ModalFooter>
              </>
            )}

            {/* Uploading Indicator */} 
            {uploadStep === "uploading" && (
              <>
                <ModalHeader><h3>Uploading...</h3></ModalHeader>
                <ModalBody>
                  <p>Processing your upload, please wait...</p>
                  {/* Consider adding a visual spinner here */} 
                </ModalBody>
                {/* Footer might be hidden or show disabled state */}
              </>
            )}
          </ModalContent>
        </Modal>
      )}

    </AppContainer>
  );
};

export default App;

